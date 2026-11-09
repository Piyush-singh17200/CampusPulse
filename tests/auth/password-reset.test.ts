import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { registerStudent } from "@/server/auth/registration";
import {
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/server/auth/password-reset";
import { resetDatabase } from "@tests/helpers/db";
import { createCollege } from "@tests/helpers/factories";
import { getSessionFromCookie, sessionCookie, signInWithPassword } from "@tests/helpers/auth";

const password = "CampusPulse!2026";
const newPassword = "CampusPulse!2027";

beforeEach(async () => {
  await resetDatabase();
});

async function createRegisteredStudent(email = "reset@example.test") {
  const college = await createCollege();
  const result = await registerStudent({
    name: "Reset Student",
    email,
    password,
    collegeId: college.id,
  });

  return { college, user: result.user };
}

function tokenFromUrl(url: string): string {
  const token = new URL(url).searchParams.get("token");

  if (!token) {
    throw new Error("Expected a reset token in the development URL.");
  }

  return token;
}

describe("password reset tokens", () => {
  it("stores only a SHA-256 hash and returns a non-production development link", async () => {
    const { user } = await createRegisteredStudent("hash-only@example.test");

    const result = await requestPasswordReset({ email: user.email.toUpperCase() });
    expect(result.devResetUrl).toBeTruthy();

    const token = tokenFromUrl(result.devResetUrl!);
    const records = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });

    expect(records).toHaveLength(1);
    expect(records[0]?.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(records[0]?.tokenHash).not.toBe(token);
    expect(records[0]?.usedAt).toBeNull();
    expect(records[0]?.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + (PASSWORD_RESET_TOKEN_TTL_MINUTES - 1) * 60_000,
    );

    const rawDatabaseText = JSON.stringify(records);
    expect(rawDatabaseText).not.toContain(token);

    const audit = await prisma.authAuditEvent.findFirstOrThrow({
      where: { userId: user.id, event: "PASSWORD_RESET_REQUESTED" },
    });
    expect(audit.emailHash).toHaveLength(64);
    expect(JSON.stringify(audit)).not.toContain(user.email);
  });

  it("invalidates prior unused tokens when a new reset is requested", async () => {
    const { user } = await createRegisteredStudent("prior-token@example.test");

    const first = await requestPasswordReset({ email: user.email });
    const second = await requestPasswordReset({ email: user.email });
    const firstToken = tokenFromUrl(first.devResetUrl!);
    const secondToken = tokenFromUrl(second.devResetUrl!);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    expect(tokens).toHaveLength(2);
    expect(tokens[0]?.usedAt).not.toBeNull();
    expect(tokens[1]?.usedAt).toBeNull();

    await expect(
      resetPasswordWithToken({ token: firstToken, password: newPassword }),
    ).rejects.toMatchObject({ code: "INVALID_RESET_TOKEN" });

    await expect(
      resetPasswordWithToken({ token: secondToken, password: newPassword }),
    ).resolves.toEqual({ userId: user.id });
  });

  it("replaces the password, revokes all sessions, and is single-use", async () => {
    const { user } = await createRegisteredStudent("single-use@example.test");
    const firstCookie = sessionCookie(await signInWithPassword(user.email, password));
    const secondCookie = sessionCookie(await signInWithPassword(user.email, password));

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
    expect(await getSessionFromCookie(firstCookie)).not.toBeNull();
    expect(await getSessionFromCookie(secondCookie)).not.toBeNull();

    const request = await requestPasswordReset({ email: user.email });
    const token = tokenFromUrl(request.devResetUrl!);

    await resetPasswordWithToken({ token, password: newPassword });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await getSessionFromCookie(firstCookie)).toBeNull();
    expect(await getSessionFromCookie(secondCookie)).toBeNull();

    const oldPasswordSignIn = await signInWithPassword(user.email, password);
    expect(oldPasswordSignIn.status).toBe(401);

    const newPasswordSignIn = await signInWithPassword(user.email, newPassword);
    expect(newPasswordSignIn.status).toBe(200);

    const audit = await prisma.authAuditEvent.findFirstOrThrow({
      where: { userId: user.id, event: "PASSWORD_RESET_COMPLETED" },
    });
    expect(audit.metadata).toMatchObject({ revokedCount: 2 });

    await expect(
      resetPasswordWithToken({ token, password: "CampusPulse!2028" }),
    ).rejects.toMatchObject({ code: "INVALID_RESET_TOKEN" });
  });

  it("rejects an expired token without changing the password", async () => {
    const { user } = await createRegisteredStudent("expired-token@example.test");
    const request = await requestPasswordReset({ email: user.email });
    const token = tokenFromUrl(request.devResetUrl!);

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await expect(resetPasswordWithToken({ token, password: newPassword })).rejects.toMatchObject({
      code: "INVALID_RESET_TOKEN",
    });

    expect((await signInWithPassword(user.email, password)).status).toBe(200);
    expect((await signInWithPassword(user.email, newPassword)).status).toBe(401);
  });

  it("keeps unknown and inactive accounts indistinguishable", async () => {
    const { user } = await createRegisteredStudent("inactive-reset@example.test");
    await prisma.user.update({ where: { id: user.id }, data: { status: "DISABLED" } });

    const unknown = await requestPasswordReset({ email: "nobody@example.test" });
    const inactive = await requestPasswordReset({ email: user.email });

    expect(unknown.devResetUrl).toBeUndefined();
    expect(inactive.devResetUrl).toBeUndefined();
    expect(await prisma.passwordResetToken.count()).toBe(0);

    const unknownAudit = await prisma.authAuditEvent.findFirstOrThrow({
      where: { event: "PASSWORD_RESET_REQUESTED", userId: null },
    });
    expect(unknownAudit.metadata).toMatchObject({ delivery: "none" });
  });

  it("rejects malformed and unknown reset tokens with the same domain error", async () => {
    await expect(
      resetPasswordWithToken({ token: "not-a-real-token-value", password: newPassword }),
    ).rejects.toMatchObject({ code: "INVALID_RESET_TOKEN" });

    await expect(
      resetPasswordWithToken({
        token: "A".repeat(43),
        password: newPassword,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESET_TOKEN" });
  });
});

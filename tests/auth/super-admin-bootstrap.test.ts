import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { bootstrapSuperAdmin } from "@/server/auth/super-admin";
import { resetDatabase } from "@tests/helpers/db";
import { createCollege, createUser } from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

describe("CLI super-admin bootstrap", () => {
  it("promotes an existing active account, revokes sessions, and audits the change", async () => {
    const college = await createCollege();
    const user = await createUser({
      email: "bootstrap@example.test",
      collegeId: college.id,
      role: "COLLEGE_ADMIN",
    });

    await prisma.session.create({
      data: {
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
        userId: user.id,
      },
    });

    const result = await bootstrapSuperAdmin("  BOOTSTRAP@Example.TEST ");

    expect(result).toMatchObject({
      userId: user.id,
      email: "bootstrap@example.test",
      previousRole: "COLLEGE_ADMIN",
      changed: true,
      revokedSessionCount: 1,
    });

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.role).toBe("SUPER_ADMIN");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);

    const audit = await prisma.authAuditEvent.findFirstOrThrow({
      where: { userId: user.id, event: "SUPER_ADMIN_PROVISIONED" },
    });
    expect(audit.metadata).toMatchObject({
      previousRole: "COLLEGE_ADMIN",
      revokedCount: 1,
      source: "cli",
    });

    // Bootstrap never creates a credential or a default password.
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0);
  });

  it("is idempotent for an existing super administrator", async () => {
    const user = await createUser({ role: "SUPER_ADMIN", email: "already-admin@example.test" });

    const result = await bootstrapSuperAdmin(user.email);

    expect(result).toMatchObject({
      userId: user.id,
      previousRole: "SUPER_ADMIN",
      changed: false,
      revokedSessionCount: 0,
    });
    expect(
      await prisma.authAuditEvent.count({
        where: { userId: user.id, event: "SUPER_ADMIN_PROVISIONED" },
      }),
    ).toBe(0);
  });

  it("refuses missing, deleted, and inactive accounts", async () => {
    const college = await createCollege();

    await expect(bootstrapSuperAdmin("missing@example.test")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const disabled = await createUser({
      email: "disabled-bootstrap@example.test",
      collegeId: college.id,
      status: "DISABLED",
    });
    await expect(bootstrapSuperAdmin(disabled.email)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const deleted = await createUser({
      email: "deleted-bootstrap@example.test",
      collegeId: college.id,
      deletedAt: new Date(),
    });
    await expect(bootstrapSuperAdmin(deleted.email)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects invalid email input", async () => {
    await expect(bootstrapSuperAdmin("not-an-email")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});

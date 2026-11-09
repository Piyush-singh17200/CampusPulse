import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { registerStudent } from "@/server/auth/registration";
import { resetDatabase } from "@tests/helpers/db";
import { createCollege } from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

const validPassword = "CampusPulse!2026";

describe("student registration", () => {
  it("creates a student, profile, credential account, and audit event transactionally", async () => {
    const college = await createCollege();

    const result = await registerStudent({
      name: "  Ada Lovelace  ",
      email: "  ADA@Example.TEST ",
      password: validPassword,
      collegeId: college.id,
      // These are deliberately ignored by the schema/action boundary.
      role: "SUPER_ADMIN",
      college: "attacker-controlled",
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } });
    expect(user.email).toBe("ada@example.test");
    expect(user.name).toBe("Ada Lovelace");
    expect(user.role).toBe("STUDENT");
    expect(user.status).toBe("ACTIVE");
    expect(user.collegeId).toBe(college.id);
    expect(user.emailVerified).toBe(false);

    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId_collegeId: { userId: user.id, collegeId: college.id } },
    });
    expect(profile.id).toBe(result.profileId);

    const account = await prisma.account.findFirstOrThrow({
      where: { userId: user.id, providerId: "credential" },
    });
    expect(account.accountId).toBe(user.id);
    expect(account.password).not.toBe(validPassword);
    expect(account.password).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(account.password!, validPassword)).resolves.toBe(true);

    const audit = await prisma.authAuditEvent.findFirstOrThrow({
      where: { userId: user.id, event: "REGISTERED" },
    });
    expect(audit.collegeId).toBe(college.id);
    expect(audit.emailHash).toHaveLength(64);
    expect(audit.emailHash).not.toContain("ada@example.test");
    expect(JSON.stringify(audit.metadata)).not.toContain(validPassword);
  });

  it("rejects duplicate email addresses without creating a second user", async () => {
    const college = await createCollege();
    const input = {
      name: "Grace Hopper",
      email: "grace@example.test",
      password: validPassword,
      collegeId: college.id,
    };

    await registerStudent(input);

    await expect(registerStudent(input)).rejects.toMatchObject({ code: "ACCOUNT_EXISTS" });

    expect(await prisma.user.count({ where: { email: "grace@example.test" } })).toBe(1);
    expect(await prisma.account.count()).toBe(1);
  });

  it("rejects registration for an inactive or missing college", async () => {
    const inactiveCollege = await createCollege({ status: "SUSPENDED" });

    await expect(
      registerStudent({
        name: "Inactive College Student",
        email: "inactive@example.test",
        password: validPassword,
        collegeId: inactiveCollege.id,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    await expect(
      registerStudent({
        name: "Missing College Student",
        email: "missing@example.test",
        password: validPassword,
        collegeId: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(await prisma.user.count()).toBe(0);
  });

  it("rejects weak passwords and invalid names before creating records", async () => {
    const college = await createCollege();

    await expect(
      registerStudent({
        name: "A",
        email: "not-an-email",
        password: "short",
        collegeId: college.id,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(await prisma.user.count()).toBe(0);
  });

  it("uses Argon2id hashes and never stores the plaintext password", async () => {
    const hash = await hashPassword(validPassword);

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(validPassword);
    await expect(verifyPassword(hash, validPassword)).resolves.toBe(true);
    await expect(verifyPassword(hash, "WrongPassword!2026")).resolves.toBe(false);
  });
});

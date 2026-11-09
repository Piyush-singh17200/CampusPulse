import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/server/db/client";
import { isPrismaUniqueConstraintError, runInTransaction } from "@/server/db/transactions";
import { AccountAlreadyExistsError, InvalidInputError } from "@/server/errors";
import { parseServiceInput } from "@/services/validation";

import { writeAuthAuditEvent } from "./audit";
import { hashPassword } from "./password";
import { normalizeEmail, registrationSchema } from "./validation";

export type RegistrationAuditContext = {
  ipHash?: string;
  userAgent?: string;
};

export type RegisteredStudent = {
  user: {
    id: string;
    name: string;
    email: string;
    collegeId: string;
    role: "STUDENT";
    status: "ACTIVE";
  };
  profileId: string;
};

/**
 * Creates a student account through a validated, server-controlled flow.
 *
 * Better Auth's public sign-up endpoint is disabled. This function is the only
 * registration path, always assigns STUDENT, and creates the Better Auth
 * credential account in the same transaction as the user and profile.
 */
export async function registerStudent(
  input: unknown,
  auditContext: RegistrationAuditContext = {},
): Promise<RegisteredStudent> {
  const data = parseServiceInput(registrationSchema, input);
  const email = normalizeEmail(data.email);
  const passwordHash = await hashPassword(data.password);

  try {
    return await runInTransaction(prisma, async (tx) => {
      const college = await tx.college.findFirst({
        where: { id: data.collegeId, status: "ACTIVE", deletedAt: null },
        select: { id: true },
      });

      if (!college) {
        throw new InvalidInputError("Select an active college to continue.");
      }

      const user = await tx.user.create({
        data: {
          name: data.name,
          email,
          emailVerified: false,
          collegeId: college.id,
          role: "STUDENT",
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          email: true,
          collegeId: true,
          role: true,
          status: true,
        },
      });

      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          collegeId: college.id,
        },
        select: { id: true },
      });

      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });

      await writeAuthAuditEvent(tx, {
        userId: user.id,
        collegeId: college.id,
        event: "REGISTERED",
        email,
        ipHash: auditContext.ipHash,
        userAgent: auditContext.userAgent,
        metadata: { role: "STUDENT" },
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          collegeId: college.id,
          role: "STUDENT",
          status: "ACTIVE",
        },
        profileId: profile.id,
      };
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new AccountAlreadyExistsError(
        "An account with this email already exists. Try signing in or resetting your password.",
      );
    }

    throw error;
  }
}

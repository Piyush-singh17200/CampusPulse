import "server-only";

import { prisma } from "@/server/db/client";
import { runInTransaction } from "@/server/db/transactions";
import { DomainError, InvalidInputError } from "@/server/errors";
import { parseServiceInput } from "@/services/validation";

import { writeAuthAuditEvent } from "./audit";
import { revokeAllSessionsForUser } from "./session-revocation";
import { emailSchema, normalizeEmail } from "./validation";

export type SuperAdminBootstrapResult = {
  userId: string;
  email: string;
  previousRole: "STUDENT" | "CLUB_ADMIN" | "COLLEGE_ADMIN" | "SUPER_ADMIN";
  changed: boolean;
  revokedSessionCount: number;
};

/**
 * CLI-only super-admin bootstrap.
 *
 * This is deliberately not exposed through an HTTP route or Server Action.
 * It promotes an existing, active account without creating a default password
 * and revokes that user's sessions so the new privilege cannot be inherited by
 * an old session.
 */
export async function bootstrapSuperAdmin(emailInput: string): Promise<SuperAdminBootstrapResult> {
  const email = normalizeEmail(parseServiceInput(emailSchema, emailInput));

  if (!email) {
    throw new InvalidInputError("A valid account email is required.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, status: true, deletedAt: true, collegeId: true },
  });

  if (!user || user.deletedAt) {
    throw new DomainError("NOT_FOUND", "No account exists for that email.", 404);
  }

  if (user.status !== "ACTIVE") {
    throw new DomainError(
      "FORBIDDEN",
      "Only an active account can become a super administrator.",
      403,
    );
  }

  if (user.role === "SUPER_ADMIN") {
    return {
      userId: user.id,
      email: user.email,
      previousRole: user.role,
      changed: false,
      revokedSessionCount: 0,
    };
  }

  return runInTransaction(prisma, async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { role: "SUPER_ADMIN" },
      select: { id: true, email: true, role: true },
    });

    const revokedSessionCount = await revokeAllSessionsForUser(tx, user.id);

    await writeAuthAuditEvent(tx, {
      userId: user.id,
      collegeId: user.collegeId,
      event: "SUPER_ADMIN_PROVISIONED",
      email: user.email,
      metadata: {
        previousRole: user.role,
        revokedCount: revokedSessionCount,
        source: "cli",
      },
    });

    return {
      userId: updated.id,
      email: updated.email,
      previousRole: user.role,
      changed: true,
      revokedSessionCount,
    };
  });
}

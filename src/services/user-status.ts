import "server-only";

import { z } from "zod";

import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { runInTransaction } from "@/server/db/transactions";
import { ActorNotAuthorizedError, DomainError } from "@/server/errors";
import { writeAuthAuditEvent } from "@/server/auth/audit";
import { revokeAllSessionsForUser } from "@/server/auth/session-revocation";
import { assertActorActive, isSuperAdmin, type AuthenticatedActor } from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";

const changeUserStatusSchema = z.object({
  targetUserId: uuidSchema,
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]),
});

/**
 * Account status changes are administrative only. College administrators may
 * manage users in their own college but can never modify platform
 * administrators. Suspending or disabling an account revokes every session.
 */
export async function changeUserStatus(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(changeUserStatusSchema, input);

  return runInTransaction(prisma, async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: data.targetUserId },
      select: {
        id: true,
        collegeId: true,
        role: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!target || target.deletedAt) {
      throw new DomainError("NOT_FOUND", "The requested user does not exist.", 404);
    }

    if (actor.id === target.id) {
      throw new ActorNotAuthorizedError("You cannot change your own account status.");
    }

    if (!isSuperAdmin(actor)) {
      if (actor.role !== "COLLEGE_ADMIN" || actor.collegeId !== target.collegeId) {
        throw new ActorNotAuthorizedError(
          "A college administrator for the target user's college is required.",
        );
      }

      if (target.role === "SUPER_ADMIN") {
        throw new ActorNotAuthorizedError(
          "College administrators cannot modify platform administrator accounts.",
        );
      }
    }

    if (target.status === data.status) {
      return target;
    }

    const updated = await tx.user.update({
      where: { id: target.id },
      data: { status: data.status },
      select: { id: true, collegeId: true, role: true, status: true },
    });

    let revokedCount = 0;

    if (data.status !== "ACTIVE") {
      revokedCount = await revokeAllSessionsForUser(tx, target.id);
    }

    await writeAuditLog(tx, {
      collegeId: target.collegeId,
      actorUserId: actor.id,
      action: "USER_STATUS_CHANGED",
      entityType: "User",
      entityId: target.id,
      metadata: {
        from: target.status,
        to: data.status,
        revokedCount,
      },
    });

    if (revokedCount > 0) {
      await writeAuthAuditEvent(tx, {
        userId: target.id,
        collegeId: target.collegeId,
        event: "SESSION_REVOKED",
        metadata: {
          reason: "status_changed",
          fromStatus: target.status,
          toStatus: data.status,
          revokedCount,
        },
      });
    }

    return updated;
  });
}

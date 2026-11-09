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

const changeUserRoleSchema = z.object({
  targetUserId: uuidSchema,
  role: z.enum(["STUDENT", "CLUB_ADMIN", "COLLEGE_ADMIN", "SUPER_ADMIN"]),
});

/**
 * Role changes are intentionally narrow:
 * - a college administrator may change users in the same college;
 * - a college administrator cannot grant or modify SUPER_ADMIN;
 * - nobody can change their own role through this service.
 */
export async function changeUserRole(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(changeUserRoleSchema, input);

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
      throw new ActorNotAuthorizedError("You cannot change your own role.");
    }

    if (!isSuperAdmin(actor)) {
      if (actor.role !== "COLLEGE_ADMIN" || actor.collegeId !== target.collegeId) {
        throw new ActorNotAuthorizedError(
          "A college administrator for the target user's college is required.",
        );
      }

      if (target.role === "SUPER_ADMIN" || data.role === "SUPER_ADMIN") {
        throw new ActorNotAuthorizedError(
          "College administrators cannot grant or modify the platform administrator role.",
        );
      }
    }

    if (target.role === data.role) {
      return target;
    }

    const updated = await tx.user.update({
      where: { id: target.id },
      data: { role: data.role },
      select: {
        id: true,
        collegeId: true,
        role: true,
        status: true,
      },
    });

    const revokedSessionCount = await revokeAllSessionsForUser(tx, target.id);

    await writeAuditLog(tx, {
      collegeId: target.collegeId,
      actorUserId: actor.id,
      action: "USER_ROLE_CHANGED",
      entityType: "User",
      entityId: target.id,
      metadata: { from: target.role, to: data.role, revokedCount: revokedSessionCount },
    });

    await writeAuthAuditEvent(tx, {
      userId: target.id,
      collegeId: target.collegeId,
      event: "SESSION_REVOKED",
      metadata: {
        reason: "role_changed",
        fromRole: target.role,
        toRole: data.role,
        revokedCount: revokedSessionCount,
      },
    });

    return updated;
  });
}

import "server-only";

import { z } from "zod";

import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { runInTransaction } from "@/server/db/transactions";
import { ActorNotAuthorizedError, DomainError, InvalidTransitionError } from "@/server/errors";
import { assertActorActive, isSuperAdmin, type AuthenticatedActor } from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";

const clubDecisionSchema = z.object({
  clubId: uuidSchema,
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(500).optional(),
});

/**
 * College administrators approve clubs only within their own college. Platform
 * administrators may act across colleges. Club administrators and students
 * cannot approve their own or any other club.
 */
export async function decideClub(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(clubDecisionSchema, input);

  if (data.decision === "REJECT" && (!data.reason || data.reason.trim().length < 3)) {
    throw new DomainError("INVALID_INPUT", "A rejection reason is required.", 422);
  }

  return runInTransaction(prisma, async (tx) => {
    const club = await tx.club.findUnique({
      where: { id: data.clubId },
      select: { id: true, collegeId: true, status: true, name: true },
    });

    if (!club) {
      throw new DomainError("NOT_FOUND", "The requested club does not exist.", 404);
    }

    if (!isSuperAdmin(actor)) {
      if (actor.role !== "COLLEGE_ADMIN" || actor.collegeId !== club.collegeId) {
        throw new ActorNotAuthorizedError(
          "A college administrator for this college is required to review a club.",
        );
      }
    }

    if (club.status !== "PENDING") {
      throw new InvalidTransitionError(`A ${club.status.toLowerCase()} club cannot be reviewed.`);
    }

    const nextStatus = data.decision === "APPROVE" ? "ACTIVE" : "REJECTED";
    const result = await tx.club.updateMany({
      where: { id: club.id, collegeId: club.collegeId, status: "PENDING" },
      data: {
        status: nextStatus,
        approvedAt: data.decision === "APPROVE" ? new Date() : null,
        statusReason: data.decision === "REJECT" ? (data.reason ?? null) : null,
      },
    });

    if (result.count !== 1) {
      throw new DomainError("CONFLICT", "The club changed while it was being reviewed.", 409);
    }

    await writeAuditLog(tx, {
      collegeId: club.collegeId,
      actorUserId: actor.id,
      action: data.decision === "APPROVE" ? "CLUB_APPROVED" : "CLUB_REJECTED",
      entityType: "Club",
      entityId: club.id,
      metadata: {
        clubName: club.name,
        from: club.status,
        to: nextStatus,
        reason: data.reason ?? null,
      },
    });

    return tx.club.findUniqueOrThrow({ where: { id: club.id } });
  });
}

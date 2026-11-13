import "server-only";

import { z } from "zod";

import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { runInTransaction } from "@/server/db/transactions";
import { ActorNotAuthorizedError, DomainError, InvalidTransitionError } from "@/server/errors";
import {
  assertActorActive,
  assertClubManagerFor,
  isSuperAdmin,
  type AuthenticatedActor,
} from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";

const clubDecisionSchema = z.object({
  clubId: uuidSchema,
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(500).optional(),
});

const updateClubProfileSchema = z.object({
  clubId: uuidSchema,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
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

/**
 * Club profile changes are limited to the active club's president/officer.
 * Ownership, college, status, and approval fields are never accepted from the
 * browser.
 */
export async function updateClubProfile(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(updateClubProfileSchema, input);

  return runInTransaction(prisma, async (tx) => {
    const club = await tx.club.findUnique({
      where: { id: data.clubId },
      select: {
        id: true,
        collegeId: true,
        status: true,
        name: true,
        description: true,
        deletedAt: true,
      },
    });

    if (!club || club.deletedAt) {
      throw new DomainError("NOT_FOUND", "The requested club does not exist.", 404);
    }

    if (club.status !== "ACTIVE") {
      throw new ActorNotAuthorizedError("Only active clubs can update their profile.");
    }

    assertClubManagerFor(actor, club.id, club.collegeId);

    const description = data.description?.trim() ? data.description.trim() : null;

    const updated = await tx.club.update({
      where: { id: club.id },
      data: { name: data.name, description },
    });

    await writeAuditLog(tx, {
      collegeId: club.collegeId,
      actorUserId: actor.id,
      action: "CLUB_UPDATED",
      entityType: "Club",
      entityId: club.id,
      metadata: {
        changedFields: [
          ...(club.name !== data.name ? ["name"] : []),
          ...(club.description !== description ? ["description"] : []),
        ],
      },
    });

    return updated;
  });
}

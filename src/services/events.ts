import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { EventStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { createNotifications } from "@/server/db/notifications";
import { runInTransaction } from "@/server/db/transactions";
import {
  clearPendingDuplicatesForEvent,
  refreshEventDuplicates,
} from "@/services/duplicate-events";
import {
  ActorNotAuthorizedError,
  DomainError,
  InvalidInputError,
  InvalidTransitionError,
} from "@/server/errors";
import {
  assertActorActive,
  assertClubManagerFor,
  isClubManagerFor,
  isSuperAdmin,
  type AuthenticatedActor,
} from "@/services/authorization";
import {
  getActiveClubManagerIds,
  getAttendedRegistrationUserIds,
  getConfirmedRegistrationUserIds,
} from "@/services/notification-recipients";
import { revokeAttendanceCredentialsForEvent } from "@/services/attendance-credentials";
import {
  assertDateOrder,
  eventStatusSchema,
  parseServiceInput,
  slugify,
  uuidSchema,
} from "@/services/validation";

/**
 * Explicit event lifecycle. Additional transitions were added only where they
 * are operationally necessary:
 * - PENDING_APPROVAL -> CANCELLED: a club can withdraw an event before review.
 * - PUBLISHED -> COMPLETED: a college records that a published event finished.
 *
 * There is intentionally no CANCELLED -> PUBLISHED, COMPLETED -> PUBLISHED, or
 * PENDING_APPROVAL -> DRAFT shortcut. Those would hide history or bypass review.
 */
export const EVENT_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  DRAFT: ["PENDING_APPROVAL"],
  PENDING_APPROVAL: ["PUBLISHED", "REJECTED", "CANCELLED"],
  PUBLISHED: ["CANCELLED", "COMPLETED"],
  REJECTED: ["DRAFT"],
  CANCELLED: [],
  COMPLETED: [],
};

const baseEventFields = {
  title: z.string().trim().min(3).max(180),
  summary: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  registrationOpensAt: z.coerce.date().nullable().optional(),
  registrationDeadline: z.coerce.date().nullable().optional(),
  venueName: z.string().trim().min(1).max(180),
  venueAddress: z.string().trim().max(300).nullable().optional(),
  isOnline: z.boolean().default(false),
  onlineUrl: z.string().url().max(500).nullable().optional(),
  capacity: z.number().int().positive().max(100_000).nullable().optional(),
  categoryIds: z.array(uuidSchema).max(10).optional(),
  interestIds: z.array(uuidSchema).max(20).optional(),
};

const createEventSchema = z
  .object({
    clubId: uuidSchema,
    ...baseEventFields,
    categoryIds: z.array(uuidSchema).max(10).default([]),
    interestIds: z.array(uuidSchema).max(20).default([]),
  })
  .superRefine((value, context) => {
    if (value.isOnline && !value.onlineUrl) {
      context.addIssue({
        code: "custom",
        path: ["onlineUrl"],
        message: "An online event requires a URL.",
      });
    }
  });

const updateEventSchema = z
  .object({
    eventId: uuidSchema,
    title: baseEventFields.title.optional(),
    summary: baseEventFields.summary,
    description: baseEventFields.description,
    startsAt: baseEventFields.startsAt.optional(),
    endsAt: baseEventFields.endsAt.optional(),
    registrationOpensAt: baseEventFields.registrationOpensAt,
    registrationDeadline: baseEventFields.registrationDeadline,
    venueName: baseEventFields.venueName.optional(),
    venueAddress: baseEventFields.venueAddress,
    isOnline: baseEventFields.isOnline.optional(),
    onlineUrl: baseEventFields.onlineUrl,
    capacity: baseEventFields.capacity,
    categoryIds: baseEventFields.categoryIds,
    interestIds: baseEventFields.interestIds,
  })
  .superRefine((value, context) => {
    if (value.isOnline === true && value.onlineUrl === null) {
      context.addIssue({
        code: "custom",
        path: ["onlineUrl"],
        message: "An online event requires a URL.",
      });
    }
  });

const transitionEventSchema = z.object({
  eventId: uuidSchema,
  to: eventStatusSchema,
  reason: z.string().trim().max(500).optional(),
});

type EventWithClub = Prisma.EventGetPayload<{ include: { club: true } }>;

function assertTransitionAllowed(from: EventStatus, to: EventStatus): void {
  if (!EVENT_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(`Event cannot transition from ${from} to ${to}.`);
  }
}

function assertCanCreateEvent(
  actor: AuthenticatedActor,
  club: { id: string; collegeId: string; status: string },
): void {
  if (club.status !== "ACTIVE") {
    throw new ActorNotAuthorizedError("Events can only be created for an active club.");
  }

  // Event creation is club-owned. The composite creator foreign key requires
  // the creator to belong to the same college as the event, so a platform admin
  // cannot be the creator of a club event. Platform admins can still review and
  // transition existing events across colleges.
  assertClubManagerFor(actor, club.id, club.collegeId);
}

function assertCanManageEvent(actor: AuthenticatedActor, event: EventWithClub): void {
  if (isSuperAdmin(actor)) {
    return;
  }

  if (actor.role === "COLLEGE_ADMIN") {
    if (actor.collegeId !== event.collegeId) {
      throw new ActorNotAuthorizedError("A college administrator for this college is required.");
    }
    return;
  }

  if (event.club.status !== "ACTIVE") {
    throw new ActorNotAuthorizedError("This club is not active.");
  }

  assertClubManagerFor(actor, event.clubId, event.collegeId);
}

function assertCanTransition(
  actor: AuthenticatedActor,
  event: EventWithClub,
  to: EventStatus,
): void {
  if (isSuperAdmin(actor)) {
    return;
  }

  if (actor.role === "COLLEGE_ADMIN") {
    if (actor.collegeId !== event.collegeId) {
      throw new ActorNotAuthorizedError("A college administrator for this college is required.");
    }
    return;
  }

  if (actor.role !== "CLUB_ADMIN") {
    throw new ActorNotAuthorizedError("Only club or college administrators may change an event.");
  }

  if (event.club.status !== "ACTIVE" || !isClubManagerFor(actor, event.clubId, event.collegeId)) {
    throw new ActorNotAuthorizedError(
      "Only an active president or officer of this club may change this event.",
    );
  }

  const clubAdminTransitions: Partial<Record<EventStatus, readonly EventStatus[]>> = {
    DRAFT: ["PENDING_APPROVAL"],
    PENDING_APPROVAL: ["CANCELLED"],
    REJECTED: ["DRAFT"],
    PUBLISHED: ["CANCELLED", "COMPLETED"],
  };

  if (!clubAdminTransitions[event.status]?.includes(to)) {
    throw new ActorNotAuthorizedError("Club administrators cannot perform this approval action.");
  }
}

function assertReasonForTerminalState(to: EventStatus, reason?: string): void {
  if ((to === "REJECTED" || to === "CANCELLED") && (!reason || reason.trim().length < 3)) {
    throw new InvalidInputError(`A reason is required when an event is ${to.toLowerCase()}.`);
  }
}

function auditActionForTransition(to: EventStatus) {
  switch (to) {
    case "PUBLISHED":
      return "EVENT_APPROVED" as const;
    case "REJECTED":
      return "EVENT_REJECTED" as const;
    case "CANCELLED":
      return "EVENT_CANCELLED" as const;
    default:
      return "EVENT_STATUS_CHANGED" as const;
  }
}

async function makeUniqueSlug(
  tx: Prisma.TransactionClient,
  collegeId: string,
  title: string,
): Promise<string> {
  const base = slugify(title) || "event";
  let candidate = base;
  let suffix = 2;

  while (
    await tx.event.findUnique({
      where: { collegeId_slug: { collegeId, slug: candidate } },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

async function validateEventTaxonomy(
  tx: Prisma.TransactionClient,
  collegeId: string,
  categoryIds: string[],
  interestIds: string[],
): Promise<void> {
  if (categoryIds.length) {
    const categories = await tx.category.findMany({
      where: { id: { in: categoryIds }, collegeId, isActive: true },
      select: { id: true },
    });

    if (categories.length !== categoryIds.length) {
      throw new InvalidInputError(
        "One or more selected categories are not available for this college.",
      );
    }
  }

  if (interestIds.length) {
    const interests = await tx.interest.findMany({
      where: { id: { in: interestIds }, isActive: true },
      select: { id: true },
    });

    if (interests.length !== interestIds.length) {
      throw new InvalidInputError("One or more selected interests are not available.");
    }
  }
}

async function replaceEventTaxonomy(
  tx: Prisma.TransactionClient,
  event: { id: string; collegeId: string },
  categoryIds: string[] | null,
  interestIds: string[] | null,
): Promise<void> {
  if (categoryIds !== null) {
    await tx.eventCategory.deleteMany({
      where: { eventId: event.id, collegeId: event.collegeId },
    });
    if (categoryIds.length) {
      await tx.eventCategory.createMany({
        data: categoryIds.map((categoryId) => ({
          collegeId: event.collegeId,
          eventId: event.id,
          categoryId,
        })),
      });
    }
  }

  if (interestIds !== null) {
    await tx.eventInterest.deleteMany({
      where: { eventId: event.id, collegeId: event.collegeId },
    });
    if (interestIds.length) {
      await tx.eventInterest.createMany({
        data: interestIds.map((interestId) => ({
          collegeId: event.collegeId,
          eventId: event.id,
          interestId,
        })),
      });
    }
  }
}

export async function createEventDraft(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(createEventSchema, input);
  assertDateOrder(data);

  return runInTransaction(prisma, async (tx) => {
    const club = await tx.club.findUnique({
      where: { id: data.clubId },
      select: { id: true, collegeId: true, status: true },
    });

    if (!club) {
      throw new DomainError("NOT_FOUND", "The requested club does not exist.", 404);
    }

    if (actor.collegeId !== club.collegeId) {
      throw new ActorNotAuthorizedError("The club does not belong to the actor's college.");
    }

    assertCanCreateEvent(actor, club);
    const categoryIds = uniqueIds(data.categoryIds);
    const interestIds = uniqueIds(data.interestIds);
    await validateEventTaxonomy(tx, club.collegeId, categoryIds, interestIds);
    const slug = await makeUniqueSlug(tx, club.collegeId, data.title);

    const event = await tx.event.create({
      data: {
        collegeId: club.collegeId,
        clubId: club.id,
        createdById: actor.id,
        title: data.title,
        slug,
        summary: data.summary ?? null,
        description: data.description ?? null,
        status: "DRAFT",
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        registrationOpensAt: data.registrationOpensAt ?? null,
        registrationDeadline: data.registrationDeadline ?? null,
        venueName: data.venueName,
        venueAddress: data.venueAddress ?? null,
        isOnline: data.isOnline,
        onlineUrl: data.onlineUrl ?? null,
        capacity: data.capacity ?? null,
      },
    });

    await replaceEventTaxonomy(tx, event, categoryIds, interestIds);

    await writeAuditLog(tx, {
      collegeId: event.collegeId,
      actorUserId: actor.id,
      action: "EVENT_CREATED",
      entityType: "Event",
      entityId: event.id,
      metadata: {
        clubId: event.clubId,
        status: event.status,
        categoryIds,
        interestIds,
      },
    });

    return event;
  });
}

export async function updateEventInTransaction(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  input: unknown,
  options: { auditMetadata?: Record<string, unknown>; skipAudit?: boolean } = {},
) {
  assertActorActive(actor);
  const data = parseServiceInput(updateEventSchema, input);

  const event = await tx.event.findUnique({
    where: { id: data.eventId },
    include: { club: true },
  });

  if (!event || event.deletedAt) {
    throw new DomainError("NOT_FOUND", "The requested event does not exist.", 404);
  }

  assertCanManageEvent(actor, event);

  if (event.status !== "DRAFT" && event.status !== "REJECTED") {
    throw new InvalidTransitionError("Only draft or rejected events can be edited.");
  }

  const merged = {
    startsAt: data.startsAt ?? event.startsAt,
    endsAt: data.endsAt ?? event.endsAt,
    registrationOpensAt:
      data.registrationOpensAt !== undefined ? data.registrationOpensAt : event.registrationOpensAt,
    registrationDeadline:
      data.registrationDeadline !== undefined
        ? data.registrationDeadline
        : event.registrationDeadline,
  };

  assertDateOrder(merged);

  const mergedIsOnline = data.isOnline ?? event.isOnline;
  const mergedOnlineUrl = data.onlineUrl !== undefined ? data.onlineUrl : event.onlineUrl;

  if (mergedIsOnline && !mergedOnlineUrl) {
    throw new InvalidInputError("An online event requires a URL.");
  }

  const categoryIds = data.categoryIds === undefined ? null : uniqueIds(data.categoryIds);
  const interestIds = data.interestIds === undefined ? null : uniqueIds(data.interestIds);

  if (categoryIds !== null || interestIds !== null) {
    await validateEventTaxonomy(tx, event.collegeId, categoryIds ?? [], interestIds ?? []);
  }

  const updateData: Prisma.EventUpdateManyMutationInput = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.summary !== undefined) updateData.summary = data.summary;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.startsAt !== undefined) updateData.startsAt = data.startsAt;
  if (data.endsAt !== undefined) updateData.endsAt = data.endsAt;
  if (data.registrationOpensAt !== undefined)
    updateData.registrationOpensAt = data.registrationOpensAt;
  if (data.registrationDeadline !== undefined)
    updateData.registrationDeadline = data.registrationDeadline;
  if (data.venueName !== undefined) updateData.venueName = data.venueName;
  if (data.venueAddress !== undefined) updateData.venueAddress = data.venueAddress;
  if (data.isOnline !== undefined) updateData.isOnline = data.isOnline;
  if (data.onlineUrl !== undefined) updateData.onlineUrl = data.onlineUrl;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;

  const changedFields = Object.keys(updateData);
  if (categoryIds !== null) changedFields.push("categories");
  if (interestIds !== null) changedFields.push("interests");

  if (changedFields.length === 0) {
    return event;
  }

  const result = await tx.event.updateMany({
    where: { id: event.id, collegeId: event.collegeId, status: event.status },
    data: changedFields.some((field) => field !== "categories" && field !== "interests")
      ? updateData
      : { updatedAt: new Date() },
  });

  if (result.count !== 1) {
    throw new DomainError("CONFLICT", "The event changed while it was being edited.", 409);
  }

  await replaceEventTaxonomy(tx, event, categoryIds, interestIds);

  if (!options.skipAudit) {
    await writeAuditLog(tx, {
      collegeId: event.collegeId,
      actorUserId: actor.id,
      action: "EVENT_UPDATED",
      entityType: "Event",
      entityId: event.id,
      metadata: { ...options.auditMetadata, changedFields },
    });
  }

  return tx.event.findUniqueOrThrow({ where: { id: event.id } });
}

export async function updateEvent(actor: AuthenticatedActor, input: unknown) {
  return runInTransaction(prisma, (tx) => updateEventInTransaction(tx, actor, input));
}

export async function transitionEvent(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(transitionEventSchema, input);
  assertReasonForTerminalState(data.to, data.reason);

  const transitioned = await runInTransaction(prisma, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: data.eventId },
      include: { club: true },
    });

    if (!event || event.deletedAt) {
      throw new DomainError("NOT_FOUND", "The requested event does not exist.", 404);
    }

    assertCanTransition(actor, event, data.to);
    assertTransitionAllowed(event.status, data.to);

    const now = new Date();
    const updateData: Prisma.EventUpdateManyMutationInput = { status: data.to };

    switch (data.to) {
      case "DRAFT":
        updateData.rejectedAt = null;
        updateData.rejectionReason = null;
        break;
      case "PENDING_APPROVAL":
        updateData.rejectedAt = null;
        updateData.rejectionReason = null;
        break;
      case "PUBLISHED":
        updateData.publishedAt = event.publishedAt ?? now;
        updateData.rejectionReason = null;
        break;
      case "REJECTED":
        updateData.rejectedAt = now;
        updateData.rejectionReason = data.reason ?? null;
        break;
      case "CANCELLED":
        updateData.cancelledAt = now;
        updateData.cancellationReason = data.reason ?? null;
        break;
      case "COMPLETED":
        updateData.completedAt = now;
        updateData.publishedAt = event.publishedAt ?? now;
        break;
    }

    const result = await tx.event.updateMany({
      where: { id: event.id, collegeId: event.collegeId, status: event.status },
      data: updateData,
    });

    if (result.count !== 1) {
      throw new DomainError("CONFLICT", "The event changed while the transition was applied.", 409);
    }

    const confirmedStudentIds =
      data.to === "CANCELLED"
        ? await getConfirmedRegistrationUserIds(tx, event.id, event.collegeId)
        : [];
    let cancelledRegistrationCount = 0;

    if (data.to === "CANCELLED") {
      const cancelled = await tx.eventRegistration.updateMany({
        where: {
          eventId: event.id,
          collegeId: event.collegeId,
          status: "CONFIRMED",
        },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      cancelledRegistrationCount = cancelled.count;
      await revokeAttendanceCredentialsForEvent(tx, event.id, event.collegeId);
    }

    if (data.to === "PUBLISHED") {
      const managerIds = await getActiveClubManagerIds(tx, event.clubId, event.collegeId);
      await createNotifications(
        tx,
        managerIds.map((userId) => ({
          collegeId: event.collegeId,
          userId,
          type: "MODERATION_UPDATE" as const,
          title: "Event approved",
          body: `"${event.title}" is now published and visible to students.`,
          actionUrl: `/club/events/${event.id}?club=${event.clubId}`,
        })),
      );
    }

    if (data.to === "REJECTED") {
      const managerIds = await getActiveClubManagerIds(tx, event.clubId, event.collegeId);
      await createNotifications(
        tx,
        managerIds.map((userId) => ({
          collegeId: event.collegeId,
          userId,
          type: "MODERATION_UPDATE" as const,
          title: "Event needs changes",
          body: `"${event.title}" was rejected. Reason: ${data.reason ?? "No reason provided."}`,
          actionUrl: `/club/events/${event.id}?club=${event.clubId}`,
        })),
      );
    }

    if (data.to === "CANCELLED") {
      await createNotifications(
        tx,
        confirmedStudentIds.map((userId) => ({
          collegeId: event.collegeId,
          userId,
          type: "REGISTRATION_UPDATE" as const,
          title: "Event cancelled",
          body: `"${event.title}" was cancelled. Reason: ${data.reason ?? "No reason provided."}`,
          actionUrl: "/student/registrations",
        })),
      );
    }

    if (data.to === "COMPLETED") {
      const attendedStudentIds = await getAttendedRegistrationUserIds(
        tx,
        event.id,
        event.collegeId,
      );
      await createNotifications(
        tx,
        attendedStudentIds.map((userId) => ({
          collegeId: event.collegeId,
          userId,
          type: "FEEDBACK_UPDATE" as const,
          title: "How was the event?",
          body: `"${event.title}" is complete. Share your feedback while the 30-day window is open.`,
          actionUrl: "/student/feedback",
        })),
      );
    }

    await writeAuditLog(tx, {
      collegeId: event.collegeId,
      actorUserId: actor.id,
      action: auditActionForTransition(data.to),
      entityType: "Event",
      entityId: event.id,
      metadata: {
        from: event.status,
        to: data.to,
        reason: data.reason ?? null,
        clubId: event.clubId,
        cancelledRegistrationCount,
      },
    });

    return tx.event.findUniqueOrThrow({ where: { id: event.id } });
  });

  // Duplicate detection is advisory and runs after the lifecycle transition is
  // committed. A detection failure must never block a valid submission.
  if (data.to === "PENDING_APPROVAL") {
    try {
      await refreshEventDuplicates(transitioned.id);
    } catch (error) {
      console.error("Could not evaluate duplicate suggestions for event", error);
    }
  } else if (data.to === "REJECTED" || data.to === "CANCELLED") {
    try {
      await clearPendingDuplicatesForEvent(transitioned.id);
    } catch (error) {
      console.error("Could not clear stale duplicate suggestions for event", error);
    }
  }

  return transitioned;
}

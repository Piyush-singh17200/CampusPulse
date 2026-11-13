import "server-only";

import { z } from "zod";

import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { runInTransaction } from "@/server/db/transactions";
import { ActorNotAuthorizedError, DomainError, TenantIsolationError } from "@/server/errors";
import { assertStudent, type AuthenticatedActor } from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";

const savedEventSchema = z.object({
  eventId: uuidSchema,
});

async function studentContext(actor: AuthenticatedActor) {
  assertStudent(actor);

  if (!actor.collegeId) {
    throw new ActorNotAuthorizedError("A student profile and college are required.");
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId_collegeId: { userId: actor.id, collegeId: actor.collegeId } },
    select: { id: true, collegeId: true },
  });

  if (!profile) {
    throw new ActorNotAuthorizedError("Only students with a profile can save events.");
  }

  return profile;
}

export async function saveEvent(actor: AuthenticatedActor, input: unknown) {
  const data = parseServiceInput(savedEventSchema, input);
  const profile = await studentContext(actor);

  return runInTransaction(prisma, async (tx) => {
    const event = await tx.event.findFirst({
      where: {
        id: data.eventId,
        collegeId: profile.collegeId,
        status: "PUBLISHED",
        deletedAt: null,
        club: { status: "ACTIVE", deletedAt: null },
      },
      select: { id: true, collegeId: true, title: true },
    });

    if (!event) {
      throw new TenantIsolationError();
    }

    const saved = await tx.savedEvent.upsert({
      where: {
        studentProfileId_eventId: {
          studentProfileId: profile.id,
          eventId: event.id,
        },
      },
      update: {},
      create: {
        collegeId: profile.collegeId,
        studentProfileId: profile.id,
        eventId: event.id,
      },
    });

    await writeAuditLog(tx, {
      collegeId: profile.collegeId,
      actorUserId: actor.id,
      action: "SAVED_EVENT_CHANGED",
      entityType: "SavedEvent",
      entityId: saved.id,
      metadata: { eventId: event.id, saved: true },
    });

    return saved;
  });
}

export async function unsaveEvent(actor: AuthenticatedActor, input: unknown) {
  const data = parseServiceInput(savedEventSchema, input);
  const profile = await studentContext(actor);

  return runInTransaction(prisma, async (tx) => {
    const existing = await tx.savedEvent.findUnique({
      where: {
        studentProfileId_eventId: {
          studentProfileId: profile.id,
          eventId: data.eventId,
        },
      },
      select: { id: true, eventId: true },
    });

    if (!existing) {
      return null;
    }

    await tx.savedEvent.delete({ where: { id: existing.id } });

    await writeAuditLog(tx, {
      collegeId: profile.collegeId,
      actorUserId: actor.id,
      action: "SAVED_EVENT_CHANGED",
      entityType: "SavedEvent",
      entityId: existing.id,
      metadata: { eventId: existing.eventId, saved: false },
    });

    return existing;
  });
}

export async function removeSavedEvent(actor: AuthenticatedActor, input: unknown) {
  return unsaveEvent(actor, input);
}

export async function assertSavedEvent(actor: AuthenticatedActor, eventId: string) {
  const data = parseServiceInput(savedEventSchema, { eventId });
  const profile = await studentContext(actor);

  const saved = await prisma.savedEvent.findUnique({
    where: {
      studentProfileId_eventId: {
        studentProfileId: profile.id,
        eventId: data.eventId,
      },
    },
    select: { id: true },
  });

  if (!saved) {
    throw new DomainError("NOT_FOUND", "This event is not in your saved list.", 404);
  }

  return saved;
}

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { assertStudent, type AuthenticatedActor } from "@/services/authorization";

export type ScheduleConflictType = "HARD" | "POTENTIAL";

export type ScheduleConflict = {
  eventId: string;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  type: ScheduleConflictType;
  overlapMinutes: number | null;
  reason: string;
};

export type ScheduleEventInput = {
  id: string;
  title: string;
  startsAt: Date | null | undefined;
  endsAt: Date | null | undefined;
};

const ACTIVE_REGISTRATION_STATUSES = ["CONFIRMED", "ATTENDED", "NO_SHOW"] as const;

function validDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function validInterval(event: ScheduleEventInput): event is ScheduleEventInput & {
  startsAt: Date;
  endsAt: Date;
} {
  return validDate(event.startsAt) && validDate(event.endsAt) && event.startsAt < event.endsAt;
}

function overlapMinutes(
  targetStart: Date,
  targetEnd: Date,
  otherStart: Date,
  otherEnd: Date,
): number {
  const start = Math.max(targetStart.getTime(), otherStart.getTime());
  const end = Math.min(targetEnd.getTime(), otherEnd.getTime());
  return Math.max(0, Math.round((end - start) / 60_000));
}

/**
 * Pure interval-overlap check. Adjacent events are not conflicts:
 * A.start < B.end && B.start < A.end.
 */
export function detectScheduleConflicts(
  target: ScheduleEventInput,
  otherEvents: ScheduleEventInput[],
): ScheduleConflict[] {
  if (!validInterval(target)) {
    return [
      {
        eventId: target.id,
        title: target.title,
        startsAt: validDate(target.startsAt) ? target.startsAt : null,
        endsAt: validDate(target.endsAt) ? target.endsAt : null,
        type: "POTENTIAL",
        overlapMinutes: null,
        reason: "This event's scheduling information is incomplete or invalid.",
      },
    ];
  }

  const conflicts: ScheduleConflict[] = [];

  for (const other of otherEvents) {
    if (other.id === target.id) {
      continue;
    }

    if (!validInterval(other)) {
      conflicts.push({
        eventId: other.id,
        title: other.title,
        startsAt: validDate(other.startsAt) ? other.startsAt : null,
        endsAt: validDate(other.endsAt) ? other.endsAt : null,
        type: "POTENTIAL",
        overlapMinutes: null,
        reason: "The other registered event has incomplete or invalid scheduling information.",
      });
      continue;
    }

    if (target.startsAt < other.endsAt && other.startsAt < target.endsAt) {
      conflicts.push({
        eventId: other.id,
        title: other.title,
        startsAt: other.startsAt,
        endsAt: other.endsAt,
        type: "HARD",
        overlapMinutes: overlapMinutes(
          target.startsAt,
          target.endsAt,
          other.startsAt,
          other.endsAt,
        ),
        reason: "The event times overlap with an event you are already registered for.",
      });
    }
  }

  return conflicts.sort(
    (left, right) =>
      (left.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (right.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
      left.title.localeCompare(right.title),
  );
}

async function loadStudentProfileId(
  client: Prisma.TransactionClient | typeof prisma,
  actor: AuthenticatedActor,
): Promise<string | null> {
  if (!actor.collegeId) {
    return null;
  }

  const profile = await client.studentProfile.findUnique({
    where: { userId_collegeId: { userId: actor.id, collegeId: actor.collegeId } },
    select: { id: true },
  });

  return profile?.id ?? null;
}

async function loadRegisteredEvents(
  client: Prisma.TransactionClient | typeof prisma,
  collegeId: string,
  studentProfileId: string,
  excludeEventId: string,
): Promise<ScheduleEventInput[]> {
  const rows = await client.eventRegistration.findMany({
    where: {
      collegeId,
      studentProfileId,
      eventId: { not: excludeEventId },
      status: { in: [...ACTIVE_REGISTRATION_STATUSES] },
      event: {
        deletedAt: null,
        status: { not: "CANCELLED" },
      },
    },
    select: {
      event: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
        },
      },
    },
  });

  return rows.map((row) => row.event);
}

export async function getScheduleConflictsForEvent(
  actor: AuthenticatedActor,
  eventId: string,
): Promise<ScheduleConflict[]> {
  assertStudent(actor);

  if (!actor.collegeId) {
    return [];
  }

  const profileId = await loadStudentProfileId(prisma, actor);
  if (!profileId) {
    return [];
  }

  const target = await prisma.event.findFirst({
    where: {
      id: eventId,
      collegeId: actor.collegeId,
      status: "PUBLISHED",
      deletedAt: null,
      club: { status: "ACTIVE", deletedAt: null },
    },
    select: { id: true, title: true, startsAt: true, endsAt: true },
  });

  if (!target) {
    return [];
  }

  const registeredEvents = await loadRegisteredEvents(
    prisma,
    actor.collegeId,
    profileId,
    target.id,
  );

  return detectScheduleConflicts(target, registeredEvents);
}

/**
 * Server-side revalidation used during registration. It is deliberately
 * advisory: the existing registration model has no safe organizer override
 * flag, so the result is recorded in the audit log but does not block a valid
 * registration.
 */
export async function getScheduleConflictsForRegistration(
  tx: Prisma.TransactionClient,
  studentProfileId: string,
  collegeId: string,
  target: ScheduleEventInput,
): Promise<ScheduleConflict[]> {
  const registeredEvents = await loadRegisteredEvents(tx, collegeId, studentProfileId, target.id);
  return detectScheduleConflicts(target, registeredEvents);
}

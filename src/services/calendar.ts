import "server-only";

import { env } from "@/config/env";
import { prisma } from "@/server/db/client";
import { ActorNotAuthorizedError } from "@/server/errors";
import { assertStudent, type AuthenticatedActor } from "@/services/authorization";
import { buildIcsCalendar, type IcsEvent } from "@/lib/ics";
import { uuidSchema } from "@/services/validation";

/**
 * Calendar downloads are bounded so an unusually large account cannot exhaust
 * memory or generate an unbounded response. The extra row is fetched only to
 * detect that the cap was reached; it is never included in the ICS file.
 */
const EXPORT_LIMIT = 1_000;

function eventUrl(eventId: string): string {
  return new URL(`/student/events/${eventId}`, env.NEXT_PUBLIC_APP_URL).toString();
}

function filenameFor(label: string): string {
  return `${
    label
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "campuspulse"
  }.ics`;
}

function toIcsEvent(event: {
  id: string;
  title: string;
  summary: string | null;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  venueName: string;
  venueAddress: string | null;
  isOnline: boolean;
  onlineUrl: string | null;
  updatedAt: Date;
  club: { name: string };
  categories: { category: { name: string } }[];
}): IcsEvent {
  return {
    id: event.id,
    title: event.title,
    summary: event.summary,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    isOnline: event.isOnline,
    onlineUrl: event.onlineUrl,
    organizerName: event.club.name,
    eventUrl: eventUrl(event.id),
    categories: event.categories.map((item) => item.category.name),
    status: "CONFIRMED",
    updatedAt: event.updatedAt,
  };
}

async function studentContext(actor: AuthenticatedActor) {
  assertStudent(actor);

  if (!actor.collegeId) {
    throw new ActorNotAuthorizedError("A student college context is required.");
  }

  const [profile, college] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { userId_collegeId: { userId: actor.id, collegeId: actor.collegeId } },
      select: { id: true, collegeId: true },
    }),
    prisma.college.findFirst({
      where: { id: actor.collegeId, deletedAt: null },
      select: { timezone: true },
    }),
  ]);

  if (!profile || !college) {
    throw new ActorNotAuthorizedError("A student profile and college are required.");
  }

  return { profile, college };
}

export async function getStudentCalendarExport(
  actor: AuthenticatedActor,
  scope: "registered" | "saved",
) {
  const { profile, college } = await studentContext(actor);

  const events =
    scope === "saved"
      ? (
          await prisma.savedEvent.findMany({
            where: {
              collegeId: profile.collegeId,
              studentProfileId: profile.id,
              event: {
                status: "PUBLISHED",
                deletedAt: null,
                club: { status: "ACTIVE", deletedAt: null },
              },
            },
            select: {
              event: {
                select: {
                  id: true,
                  title: true,
                  summary: true,
                  description: true,
                  startsAt: true,
                  endsAt: true,
                  venueName: true,
                  venueAddress: true,
                  isOnline: true,
                  onlineUrl: true,
                  updatedAt: true,
                  club: { select: { name: true } },
                  categories: { select: { category: { select: { name: true } } } },
                },
              },
            },
            orderBy: { event: { startsAt: "asc" } },
            take: EXPORT_LIMIT + 1,
          })
        ).map((row) => row.event)
      : (
          await prisma.eventRegistration.findMany({
            where: {
              collegeId: profile.collegeId,
              studentProfileId: profile.id,
              status: { in: ["CONFIRMED", "ATTENDED"] },
              event: {
                status: { in: ["PUBLISHED", "COMPLETED"] },
                deletedAt: null,
                club: { status: "ACTIVE", deletedAt: null },
              },
            },
            select: {
              event: {
                select: {
                  id: true,
                  title: true,
                  summary: true,
                  description: true,
                  startsAt: true,
                  endsAt: true,
                  venueName: true,
                  venueAddress: true,
                  isOnline: true,
                  onlineUrl: true,
                  updatedAt: true,
                  club: { select: { name: true } },
                  categories: { select: { category: { select: { name: true } } } },
                },
              },
            },
            orderBy: { event: { startsAt: "asc" } },
            take: EXPORT_LIMIT + 1,
          })
        ).map((row) => row.event);

  const truncated = events.length > EXPORT_LIMIT;
  const includedEvents = truncated ? events.slice(0, EXPORT_LIMIT) : events;

  const body = buildIcsCalendar(includedEvents.map(toIcsEvent), {
    calendarName: scope === "saved" ? "CampusPulse saved events" : "CampusPulse registered events",
    timezone: college.timezone,
  });

  return {
    filename: filenameFor(
      scope === "saved" ? "campuspulse-saved-events" : "campuspulse-registered-events",
    ),
    body,
    count: includedEvents.length,
    truncated,
  };
}

export async function getEventCalendarExport(actor: AuthenticatedActor, eventId: string) {
  if (!uuidSchema.safeParse(eventId).success) {
    return null;
  }

  const { profile, college } = await studentContext(actor);

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      collegeId: profile.collegeId,
      status: { in: ["PUBLISHED", "COMPLETED"] },
      deletedAt: null,
      club: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      id: true,
      title: true,
      summary: true,
      description: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      venueAddress: true,
      isOnline: true,
      onlineUrl: true,
      updatedAt: true,
      club: { select: { name: true } },
      categories: { select: { category: { select: { name: true } } } },
    },
  });

  if (!event) {
    return null;
  }

  const body = buildIcsCalendar([toIcsEvent(event)], {
    calendarName: event.title,
    timezone: college.timezone,
  });

  return {
    filename: filenameFor(`campuspulse-${event.title}`),
    body,
    count: 1,
    truncated: false,
  };
}

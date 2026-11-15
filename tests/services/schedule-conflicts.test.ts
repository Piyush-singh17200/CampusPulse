import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { registerForEvent } from "@/services/registrations";
import {
  detectScheduleConflicts,
  getScheduleConflictsForEvent,
} from "@/services/schedule-conflicts";
import { resetDatabase } from "@tests/helpers/db";
import {
  actorForUser,
  createClub,
  createCollege,
  createEvent,
  createStudent,
  createUser,
} from "@tests/helpers/factories";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function eventInput(input: {
  id: string;
  title?: string;
  startsAt: Date | null;
  endsAt: Date | null;
}) {
  return {
    id: input.id,
    title: input.title ?? input.id,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  };
}

async function createConflictFixture() {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const { user, profile } = await createStudent(college.id);
  const actor = await actorForUser(user.id);
  const startsAt = new Date(Date.now() + 10 * DAY_MS);

  const registrationOpensAt = new Date(Date.now() - DAY_MS);
  const registrationDeadline = new Date(startsAt.getTime() - HOUR_MS);
  const first = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt,
    endsAt: new Date(startsAt.getTime() + 2 * HOUR_MS),
    registrationOpensAt,
    registrationDeadline,
  });
  const overlapping = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt: new Date(startsAt.getTime() + HOUR_MS),
    endsAt: new Date(startsAt.getTime() + 3 * HOUR_MS),
    registrationOpensAt,
    registrationDeadline: new Date(startsAt.getTime() + HOUR_MS),
  });
  const adjacent = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt: new Date(startsAt.getTime() + 2 * HOUR_MS),
    endsAt: new Date(startsAt.getTime() + 4 * HOUR_MS),
    registrationOpensAt,
    registrationDeadline: new Date(startsAt.getTime() + 2 * HOUR_MS),
  });

  return {
    college,
    club,
    creator,
    user,
    profile,
    actor,
    first,
    overlapping,
    adjacent,
  };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("schedule conflict detection", () => {
  it("uses strict interval overlap so adjacent events do not conflict", () => {
    const target = eventInput({
      id: "target",
      startsAt: new Date("2026-12-20T10:00:00.000Z"),
      endsAt: new Date("2026-12-20T12:00:00.000Z"),
    });
    const adjacent = eventInput({
      id: "adjacent",
      startsAt: new Date("2026-12-20T12:00:00.000Z"),
      endsAt: new Date("2026-12-20T14:00:00.000Z"),
    });
    const overlapping = eventInput({
      id: "overlapping",
      startsAt: new Date("2026-12-20T11:00:00.000Z"),
      endsAt: new Date("2026-12-20T13:00:00.000Z"),
    });

    expect(detectScheduleConflicts(target, [adjacent])).toEqual([]);
    expect(detectScheduleConflicts(target, [overlapping])).toMatchObject([
      {
        eventId: "overlapping",
        type: "HARD",
        overlapMinutes: 60,
      },
    ]);
  });

  it("ignores the target itself and flags incomplete intervals as potential conflicts", () => {
    const target = eventInput({
      id: "target",
      startsAt: new Date("2026-12-20T10:00:00.000Z"),
      endsAt: new Date("2026-12-20T12:00:00.000Z"),
    });

    expect(detectScheduleConflicts(target, [target])).toEqual([]);
    expect(
      detectScheduleConflicts(eventInput({ id: "invalid", startsAt: null, endsAt: null }), [
        target,
      ]),
    ).toMatchObject([
      {
        eventId: "invalid",
        type: "POTENTIAL",
        overlapMinutes: null,
      },
    ]);
    expect(
      detectScheduleConflicts(target, [
        eventInput({ id: "other", startsAt: target.startsAt, endsAt: null }),
      ]),
    ).toMatchObject([
      {
        eventId: "other",
        type: "POTENTIAL",
      },
    ]);
  });

  it("returns registered-event conflicts for a student without crossing tenants", async () => {
    const { actor, first, overlapping } = await createConflictFixture();
    await registerForEvent(actor, { eventId: first.id });

    const conflicts = await getScheduleConflictsForEvent(actor, overlapping.id);
    expect(conflicts).toMatchObject([
      {
        eventId: first.id,
        type: "HARD",
        overlapMinutes: 60,
      },
    ]);
  });
});

describe("registration schedule revalidation", () => {
  it("returns an advisory warning and records it in the audit metadata", async () => {
    const { actor, first, overlapping } = await createConflictFixture();
    await registerForEvent(actor, { eventId: first.id });

    const registration = await registerForEvent(actor, { eventId: overlapping.id });
    expect(registration.status).toBe("CONFIRMED");
    expect(registration.scheduleConflicts).toMatchObject([
      {
        eventId: first.id,
        type: "HARD",
        overlapMinutes: 60,
      },
    ]);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        entityType: "EventRegistration",
        entityId: registration.id,
        action: "REGISTRATION_STATUS_CHANGED",
      },
    });
    expect(audit.metadata).toMatchObject({
      eventId: overlapping.id,
      scheduleConflictCount: 1,
      scheduleConflicts: [
        expect.objectContaining({
          eventId: first.id,
          type: "HARD",
          overlapMinutes: 60,
        }),
      ],
    });
  });

  it("does not warn for an adjacent registration", async () => {
    const { actor, first, adjacent } = await createConflictFixture();
    await registerForEvent(actor, { eventId: first.id });

    const registration = await registerForEvent(actor, { eventId: adjacent.id });
    expect(registration.scheduleConflicts).toEqual([]);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        entityType: "EventRegistration",
        entityId: registration.id,
        action: "REGISTRATION_STATUS_CHANGED",
      },
    });
    expect(audit.metadata).toMatchObject({
      scheduleConflictCount: 0,
      scheduleConflicts: [],
    });
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { ActorNotAuthorizedError, InvalidTransitionError } from "@/server/errors";
import {
  DUPLICATE_THRESHOLD,
  getPendingDuplicateReviewsForCollege,
  refreshEventDuplicates,
  reviewDuplicate,
  scoreDuplicatePair,
} from "@/services/duplicate-events";
import { transitionEvent } from "@/services/events";
import { resetDatabase } from "@tests/helpers/db";
import {
  actorForUser,
  createClub,
  createClubAdmin,
  createCollege,
  createCollegeAdmin,
  createEvent,
  createUser,
} from "@tests/helpers/factories";

const DAY_MS = 24 * 60 * 60 * 1000;

function duplicateEventInput(input: {
  id: string;
  collegeId: string;
  clubId: string;
  title: string;
  startsAt: Date;
  venueName?: string;
  isOnline?: boolean;
  clubName?: string;
}) {
  return {
    id: input.id,
    collegeId: input.collegeId,
    clubId: input.clubId,
    title: input.title,
    startsAt: input.startsAt,
    endsAt: new Date(input.startsAt.getTime() + 2 * 60 * 60 * 1000),
    venueName: input.venueName ?? "Main Auditorium",
    isOnline: input.isOnline ?? false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    status: "PUBLISHED",
    club: { name: input.clubName ?? "Robotics Club" },
  };
}

async function createDuplicateFixture() {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const startsAt = new Date(Date.now() + 10 * DAY_MS);
  const existing = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt,
  });
  await prisma.event.update({
    where: { id: existing.id },
    data: { title: "Campus Robotics Workshop", venueName: "Main Auditorium" },
  });
  const submitted = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PENDING_APPROVAL",
    startsAt,
  });
  await prisma.event.update({
    where: { id: submitted.id },
    data: { title: "Campus Robotics Workshop 2026", venueName: "Main Auditorium" },
  });
  const collegeAdmin = await createCollegeAdmin(college.id);
  const clubAdmin = await createClubAdmin({ collegeId: college.id, clubId: club.id });

  return {
    college,
    club,
    creator,
    existing,
    submitted,
    collegeAdmin,
    collegeAdminActor: await actorForUser(collegeAdmin.id),
    clubAdminActor: await actorForUser(clubAdmin.id),
  };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("duplicate scoring", () => {
  it("scores same-day, same-venue, similarly titled events above the threshold", () => {
    const startsAt = new Date("2026-12-20T10:00:00.000Z");
    const score = scoreDuplicatePair(
      duplicateEventInput({
        id: "a",
        collegeId: "college",
        clubId: "club",
        title: "Campus Robotics Workshop",
        startsAt,
      }),
      duplicateEventInput({
        id: "b",
        collegeId: "college",
        clubId: "club",
        title: "Campus Robotics Workshop 2026",
        startsAt,
      }),
      "Asia/Kolkata",
    );

    expect(score.isDuplicate).toBe(true);
    expect(score.confidence).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
    expect(score.reasons.join(" ")).toContain("Both events start on 2026-12-20");
    expect(score.reasons.join(" ")).toContain("organized by Robotics Club");
  });

  it("does not flag different-day, different-venue, or unrelated titles", () => {
    const base = duplicateEventInput({
      id: "a",
      collegeId: "college",
      clubId: "club",
      title: "Campus Robotics Workshop",
      startsAt: new Date("2026-12-20T10:00:00.000Z"),
    });

    const differentDay = scoreDuplicatePair(
      base,
      duplicateEventInput({
        id: "b",
        collegeId: "college",
        clubId: "club",
        title: "Campus Robotics Workshop 2026",
        startsAt: new Date("2026-12-21T10:00:00.000Z"),
      }),
      "Asia/Kolkata",
    );
    const unrelated = scoreDuplicatePair(
      base,
      duplicateEventInput({
        id: "c",
        collegeId: "college",
        clubId: "club",
        title: "Annual Literary Debate",
        startsAt: new Date("2026-12-20T10:00:00.000Z"),
        venueName: "Seminar Hall",
      }),
      "Asia/Kolkata",
    );

    expect(differentDay.isDuplicate).toBe(false);
    expect(unrelated.isDuplicate).toBe(false);
  });
});

describe("duplicate review service", () => {
  it("stores advisory matches without changing either event", async () => {
    const { submitted, existing } = await createDuplicateFixture();

    const result = await refreshEventDuplicates(submitted.id);
    expect(result.created).toBe(1);

    const duplicates = await prisma.eventDuplicate.findMany({
      where: { candidateEventId: submitted.id },
    });
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toMatchObject({
      status: "PENDING",
      primaryEventId: existing.id,
      candidateEventId: submitted.id,
    });
    expect(duplicates[0]?.reasons.length).toBeGreaterThanOrEqual(3);
    expect(Number(duplicates[0]?.confidence)).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);

    const [existingAfter, submittedAfter] = await Promise.all([
      prisma.event.findUniqueOrThrow({ where: { id: existing.id } }),
      prisma.event.findUniqueOrThrow({ where: { id: submitted.id } }),
    ]);
    expect(existingAfter.status).toBe("PUBLISHED");
    expect(submittedAfter.status).toBe("PENDING_APPROVAL");
  });

  it("confirms and dismisses suggestions with audit records but never merges events", async () => {
    const { college, existing, submitted, collegeAdminActor } = await createDuplicateFixture();
    await refreshEventDuplicates(submitted.id);
    const duplicate = await prisma.eventDuplicate.findFirstOrThrow({
      where: { candidateEventId: submitted.id },
    });

    const confirmed = await reviewDuplicate(collegeAdminActor, {
      duplicateId: duplicate.id,
      decision: "CONFIRM",
    });
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.reviewedById).toBe(collegeAdminActor.id);

    const confirmedAudit = await prisma.auditLog.findFirst({
      where: { action: "DUPLICATE_CONFIRMED", entityId: duplicate.id },
    });
    expect(confirmedAudit?.collegeId).toBe(college.id);
    expect(confirmedAudit?.metadata).toMatchObject({
      primaryEventId: existing.id,
      candidateEventId: submitted.id,
      automaticEventChange: false,
    });

    await expect(
      reviewDuplicate(collegeAdminActor, {
        duplicateId: duplicate.id,
        decision: "DISMISS",
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    const stillExisting = await prisma.event.findUniqueOrThrow({ where: { id: existing.id } });
    const stillSubmitted = await prisma.event.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(stillExisting.status).toBe("PUBLISHED");
    expect(stillSubmitted.status).toBe("PENDING_APPROVAL");

    const third = await createEvent({
      collegeId: college.id,
      clubId: existing.clubId,
      createdById: existing.createdById,
      status: "PENDING_APPROVAL",
      startsAt: existing.startsAt,
    });
    await prisma.event.update({
      where: { id: third.id },
      data: { title: "Campus Robotics Workshop 2026 Edition", venueName: "Main Auditorium" },
    });
    await refreshEventDuplicates(third.id);
    const dismissible = await prisma.eventDuplicate.findFirstOrThrow({
      where: { candidateEventId: third.id },
    });
    const dismissed = await reviewDuplicate(collegeAdminActor, {
      duplicateId: dismissible.id,
      decision: "DISMISS",
    });
    expect(dismissed.status).toBe("DISMISSED");

    const dismissedAudit = await prisma.auditLog.findFirst({
      where: { action: "DUPLICATE_DISMISSED", entityId: dismissible.id },
    });
    expect(dismissedAudit?.metadata).toMatchObject({ decision: "DISMISSED" });
  });

  it("scopes reviews to the event's college and college administrators", async () => {
    const { submitted, collegeAdminActor, clubAdminActor } = await createDuplicateFixture();
    await refreshEventDuplicates(submitted.id);
    const duplicate = await prisma.eventDuplicate.findFirstOrThrow({
      where: { candidateEventId: submitted.id },
    });

    const otherCollege = await createCollege();
    const otherAdmin = await createCollegeAdmin(otherCollege.id);
    const otherAdminActor = await actorForUser(otherAdmin.id);

    await expect(
      reviewDuplicate(otherAdminActor, {
        duplicateId: duplicate.id,
        decision: "CONFIRM",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
    await expect(
      reviewDuplicate(clubAdminActor, {
        duplicateId: duplicate.id,
        decision: "CONFIRM",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    const pending = await getPendingDuplicateReviewsForCollege(collegeAdminActor);
    expect(pending.map((review) => review.id)).toContain(duplicate.id);
  });

  it("runs detection when a club submits an event for approval", async () => {
    const { college, club, creator, existing } = await createDuplicateFixture();
    const clubAdmin = await createClubAdmin({ collegeId: college.id, clubId: club.id });
    const clubAdminActor = await actorForUser(clubAdmin.id);
    const draft = await createEvent({
      collegeId: college.id,
      clubId: club.id,
      createdById: clubAdmin.id,
      status: "DRAFT",
      startsAt: existing.startsAt,
    });
    await prisma.event.update({
      where: { id: draft.id },
      data: { title: "Campus Robotics Workshop 2026", venueName: "Main Auditorium" },
    });

    const transitioned = await transitionEvent(clubAdminActor, {
      eventId: draft.id,
      to: "PENDING_APPROVAL",
    });

    expect(transitioned.status).toBe("PENDING_APPROVAL");
    const duplicate = await prisma.eventDuplicate.findFirst({
      where: {
        OR: [{ primaryEventId: draft.id }, { candidateEventId: draft.id }],
        status: "PENDING",
      },
    });
    expect(duplicate).not.toBeNull();
    expect(creator.id).not.toBe(clubAdmin.id);
  });
});

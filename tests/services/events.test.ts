import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { ActorNotAuthorizedError, InvalidTransitionError } from "@/server/errors";
import { createEventDraft, transitionEvent, updateEvent } from "@/services/events";
import { resetDatabase } from "@tests/helpers/db";
import {
  actorForUser,
  createClub,
  createClubAdmin,
  createCollege,
  createCollegeAdmin,
  createEvent,
  createStudent,
  createSuperAdmin,
  createUser,
} from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

async function createManagedEvent() {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const clubAdmin = await createClubAdmin({ collegeId: college.id, clubId: club.id });
  const collegeAdmin = await createCollegeAdmin(college.id);
  const event = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "DRAFT",
  });

  return {
    college,
    creator,
    club,
    clubAdmin,
    collegeAdmin,
    event,
    clubAdminActor: await actorForUser(clubAdmin.id),
    collegeAdminActor: await actorForUser(collegeAdmin.id),
  };
}

describe("event lifecycle", () => {
  it("allows draft -> pending approval -> published and audits both transitions", async () => {
    const { clubAdminActor, collegeAdminActor, event } = await createManagedEvent();

    const submitted = await transitionEvent(clubAdminActor, {
      eventId: event.id,
      to: "PENDING_APPROVAL",
    });
    expect(submitted.status).toBe("PENDING_APPROVAL");

    const published = await transitionEvent(collegeAdminActor, {
      eventId: event.id,
      to: "PUBLISHED",
    });
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "Event", entityId: event.id },
      orderBy: { createdAt: "asc" },
    });

    expect(audits.map((audit) => audit.action)).toEqual(["EVENT_STATUS_CHANGED", "EVENT_APPROVED"]);
  });

  it("rejects an invalid transition for an authorized actor without auditing", async () => {
    const { collegeAdminActor, event } = await createManagedEvent();

    await expect(
      transitionEvent(collegeAdminActor, {
        eventId: event.id,
        to: "COMPLETED",
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    const auditCount = await prisma.auditLog.count({
      where: { entityType: "Event", entityId: event.id },
    });
    expect(auditCount).toBe(0);
  });

  it("rejects an event and records the moderation audit", async () => {
    const { collegeAdminActor, event } = await createManagedEvent();

    await transitionEvent(collegeAdminActor, {
      eventId: event.id,
      to: "PENDING_APPROVAL",
    });

    const rejected = await transitionEvent(collegeAdminActor, {
      eventId: event.id,
      to: "REJECTED",
      reason: "The event needs a clearer accessibility plan.",
    });

    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: "Event",
        entityId: event.id,
        action: "EVENT_REJECTED",
      },
    });
    expect(audit?.actorUserId).toBe(collegeAdminActor.id);
    expect(audit?.collegeId).toBe(event.collegeId);
  });

  it("rejects an unauthorized student transition", async () => {
    const { college, event } = await createManagedEvent();
    const { user: student } = await createStudent(college.id);
    const studentActor = await actorForUser(student.id);

    await expect(
      transitionEvent(studentActor, {
        eventId: event.id,
        to: "PENDING_APPROVAL",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("rejects a club administrator trying to approve an event", async () => {
    const { clubAdminActor, event } = await createManagedEvent();
    await transitionEvent(clubAdminActor, {
      eventId: event.id,
      to: "PENDING_APPROVAL",
    });

    await expect(
      transitionEvent(clubAdminActor, {
        eventId: event.id,
        to: "PUBLISHED",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("rejects a college administrator from another college", async () => {
    const { event } = await createManagedEvent();
    const otherCollege = await createCollege();
    const otherAdmin = await createCollegeAdmin(otherCollege.id);
    const otherAdminActor = await actorForUser(otherAdmin.id);

    await expect(
      transitionEvent(otherAdminActor, {
        eventId: event.id,
        to: "PENDING_APPROVAL",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("cancels confirmed registrations when an event is cancelled", async () => {
    const { collegeAdminActor, event } = await createManagedEvent();
    const { user: student, profile } = await createStudent(event.collegeId);

    await transitionEvent(collegeAdminActor, {
      eventId: event.id,
      to: "PENDING_APPROVAL",
    });
    await transitionEvent(collegeAdminActor, {
      eventId: event.id,
      to: "PUBLISHED",
    });
    await prisma.eventRegistration.create({
      data: {
        collegeId: event.collegeId,
        eventId: event.id,
        studentProfileId: profile.id,
        status: "CONFIRMED",
      },
    });

    const cancelled = await transitionEvent(collegeAdminActor, {
      eventId: event.id,
      to: "CANCELLED",
      reason: "Venue unavailable",
    });

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();

    const registration = await prisma.eventRegistration.findFirst({
      where: { eventId: event.id, studentProfileId: profile.id },
    });
    expect(registration?.status).toBe("CANCELLED");
    expect(registration?.cancelledAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Event", entityId: event.id, action: "EVENT_CANCELLED" },
    });
    expect(audit?.actorUserId).toBe(collegeAdminActor.id);
    expect(audit?.collegeId).toBe(event.collegeId);
    expect(student.id).toBeTruthy();
  });

  it("creates and updates a draft event with audit records", async () => {
    const college = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: creator.id });
    const clubAdmin = await createClubAdmin({ collegeId: college.id, clubId: club.id });
    const clubAdminActor = await actorForUser(clubAdmin.id);
    const startsAt = new Date(Date.now() + 3 * 86_400_000);

    const event = await createEventDraft(clubAdminActor, {
      clubId: club.id,
      title: "A service-created event",
      summary: "Created through the lifecycle service.",
      description: "A test event.",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3_600_000),
      registrationOpensAt: new Date(startsAt.getTime() - 2 * 86_400_000),
      registrationDeadline: new Date(startsAt.getTime() - 3_600_000),
      venueName: "Service Hall",
      capacity: 20,
    });

    expect(event.status).toBe("DRAFT");
    expect(event.createdById).toBe(clubAdmin.id);

    const updated = await updateEvent(clubAdminActor, {
      eventId: event.id,
      title: "An updated service event",
      capacity: 30,
    });

    expect(updated.title).toBe("An updated service event");
    expect(updated.capacity).toBe(30);

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "Event", entityId: event.id },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.map((audit) => audit.action)).toEqual(["EVENT_CREATED", "EVENT_UPDATED"]);
  });

  it("allows a platform administrator to transition an event across colleges", async () => {
    const { event } = await createManagedEvent();
    const superAdmin = await createSuperAdmin();
    const superAdminActor = await actorForUser(superAdmin.id);

    const transitioned = await transitionEvent(superAdminActor, {
      eventId: event.id,
      to: "PENDING_APPROVAL",
    });

    expect(transitioned.status).toBe("PENDING_APPROVAL");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Event", entityId: event.id, action: "EVENT_STATUS_CHANGED" },
    });
    expect(audit?.actorUserId).toBe(superAdmin.id);
    expect(audit?.collegeId).toBe(event.collegeId);
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import {
  ActorNotAuthorizedError,
  InvalidInputError,
  InvalidTransitionError,
  TenantIsolationError,
} from "@/server/errors";
import {
  getClubFeedback,
  getCollegeFeedback,
  getStudentFeedback,
} from "@/server/dashboards/feedback";
import { moderateFeedback, submitFeedback, updateFeedback } from "@/services/feedback";
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

async function createFeedbackFixture() {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const manager = await createClubAdmin({ collegeId: college.id, clubId: club.id });
  const collegeAdmin = await createCollegeAdmin(college.id);
  const { user: student, profile } = await createStudent(college.id);
  const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const event = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "COMPLETED",
    startsAt: past,
    endsAt: new Date(past.getTime() + 2 * 60 * 60 * 1000),
  });
  const registration = await prisma.eventRegistration.create({
    data: {
      collegeId: college.id,
      eventId: event.id,
      studentProfileId: profile.id,
      status: "ATTENDED",
      checkedInAt: past,
    },
  });

  return {
    college,
    creator,
    club,
    manager,
    collegeAdmin,
    student,
    profile,
    event,
    registration,
    managerActor: await actorForUser(manager.id),
    collegeAdminActor: await actorForUser(collegeAdmin.id),
    studentActor: await actorForUser(student.id),
  };
}

describe("Event feedback", () => {
  it("requires verified attendance, a completed event, and a valid rating/comment", async () => {
    const fixture = await createFeedbackFixture();
    const { user: unverifiedStudent, profile: unverifiedProfile } = await createStudent(
      fixture.college.id,
    );
    await prisma.eventRegistration.create({
      data: {
        collegeId: fixture.college.id,
        eventId: fixture.event.id,
        studentProfileId: unverifiedProfile.id,
        status: "CONFIRMED",
      },
    });
    const unverifiedActor = await actorForUser(unverifiedStudent.id);

    await expect(
      submitFeedback(unverifiedActor, {
        eventId: fixture.event.id,
        rating: 5,
        comment: "Great event",
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    await expect(
      submitFeedback(fixture.studentActor, {
        eventId: fixture.event.id,
        rating: 0,
        comment: "Invalid",
      }),
    ).rejects.toBeInstanceOf(InvalidInputError);
    await expect(
      submitFeedback(fixture.studentActor, {
        eventId: fixture.event.id,
        rating: 6,
        comment: "Invalid",
      }),
    ).rejects.toBeInstanceOf(InvalidInputError);
    await expect(
      submitFeedback(fixture.studentActor, {
        eventId: fixture.event.id,
        rating: 4,
        comment: "x".repeat(2001),
      }),
    ).rejects.toBeInstanceOf(InvalidInputError);

    const publishedEvent = await createEvent({
      collegeId: fixture.college.id,
      clubId: fixture.club.id,
      createdById: fixture.creator.id,
      status: "PUBLISHED",
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await prisma.eventRegistration.create({
      data: {
        collegeId: fixture.college.id,
        eventId: publishedEvent.id,
        studentProfileId: fixture.profile.id,
        status: "ATTENDED",
        checkedInAt: new Date(),
      },
    });
    await expect(
      submitFeedback(fixture.studentActor, {
        eventId: publishedEvent.id,
        rating: 4,
        comment: "Not completed yet",
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("prevents duplicate submissions and enforces the 30-day window", async () => {
    const fixture = await createFeedbackFixture();
    const first = await submitFeedback(fixture.studentActor, {
      eventId: fixture.event.id,
      rating: 5,
      comment: "Excellent organisation.",
    });

    await expect(
      submitFeedback(fixture.studentActor, {
        eventId: fixture.event.id,
        rating: 3,
        comment: "Duplicate",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await prisma.event.update({
      where: { id: fixture.event.id },
      data: { completedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
    });
    await expect(
      updateFeedback(fixture.studentActor, {
        eventId: fixture.event.id,
        rating: 4,
        comment: "Too late",
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    expect(first.id).toBeTruthy();
  });

  it("allows editing while preserving moderation and audits the change", async () => {
    const fixture = await createFeedbackFixture();
    const feedback = await submitFeedback(fixture.studentActor, {
      eventId: fixture.event.id,
      rating: 3,
      comment: "It was fine.",
    });
    await moderateFeedback(fixture.collegeAdminActor, {
      feedbackId: feedback.id,
      decision: "HIDDEN",
      reason: "Contains an unverified personal claim.",
    });

    const updated = await updateFeedback(fixture.studentActor, {
      eventId: fixture.event.id,
      rating: 4,
      comment: "The revised comment is factual.",
    });
    expect(updated.rating).toBe(4);
    expect(updated.moderationStatus).toBe("HIDDEN");

    const audits = await prisma.auditLog.findMany({
      where: { entityId: feedback.id },
    });
    expect(audits.some((audit) => audit.action === "FEEDBACK_SUBMITTED")).toBe(true);
    expect(audits.some((audit) => audit.action === "FEEDBACK_UPDATED")).toBe(true);
    expect(audits.some((audit) => audit.action === "FEEDBACK_MODERATED")).toBe(true);
  });

  it("restricts moderation to the college tenant and platform administrators", async () => {
    const fixture = await createFeedbackFixture();
    const feedback = await submitFeedback(fixture.studentActor, {
      eventId: fixture.event.id,
      rating: 5,
      comment: "Loved it.",
    });

    await expect(
      moderateFeedback(fixture.managerActor, {
        feedbackId: feedback.id,
        decision: "HIDDEN",
        reason: "Club admins cannot moderate.",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    const otherCollege = await createCollege();
    const otherAdmin = await createCollegeAdmin(otherCollege.id);
    const otherAdminActor = await actorForUser(otherAdmin.id);
    await expect(
      moderateFeedback(otherAdminActor, {
        feedbackId: feedback.id,
        decision: "HIDDEN",
        reason: "Cross-tenant moderation.",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    const superAdmin = await createSuperAdmin();
    const superAdminActor = await actorForUser(superAdmin.id);
    const moderated = await moderateFeedback(superAdminActor, {
      feedbackId: feedback.id,
      decision: "HIDDEN",
      reason: "Platform policy review.",
    });
    expect(moderated.moderationStatus).toBe("HIDDEN");
  });

  it("returns student, club, and college feedback views with tenant-safe filters", async () => {
    const fixture = await createFeedbackFixture();
    await submitFeedback(fixture.studentActor, {
      eventId: fixture.event.id,
      rating: 5,
      comment: "A very good event.",
    });

    const studentView = await getStudentFeedback(fixture.studentActor);
    expect(studentView.counts.submitted).toBe(1);
    expect(studentView.rows[0]?.state).toBe("submitted");
    expect(studentView.rows[0]?.canEdit).toBe(true);

    const clubView = await getClubFeedback(fixture.managerActor, fixture.club.id);
    expect(clubView.summary.responseCount).toBe(1);
    expect(clubView.feedback[0]?.comment).toBe("A very good event.");

    const collegeView = await getCollegeFeedback(fixture.collegeAdminActor);
    expect(collegeView.total).toBe(1);
    expect(collegeView.summary.averageRating).toBe(5);

    const otherCollege = await createCollege();
    const otherCreator = await createUser({
      collegeId: otherCollege.id,
      role: "CLUB_ADMIN",
    });
    const otherClub = await createClub({
      collegeId: otherCollege.id,
      createdById: otherCreator.id,
    });
    const otherManager = await createClubAdmin({
      collegeId: otherCollege.id,
      clubId: otherClub.id,
    });
    const otherManagerActor = await actorForUser(otherManager.id);

    await expect(getClubFeedback(otherManagerActor, fixture.club.id)).rejects.toBeInstanceOf(
      TenantIsolationError,
    );

    const otherAdmin = await createCollegeAdmin(otherCollege.id);
    const otherAdminActor = await actorForUser(otherAdmin.id);
    const otherCollegeView = await getCollegeFeedback(otherAdminActor);
    expect(otherCollegeView.total).toBe(0);
  });
});

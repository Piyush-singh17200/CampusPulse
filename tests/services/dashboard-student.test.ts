import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { ActorNotAuthorizedError, InvalidInputError, TenantIsolationError } from "@/server/errors";
import { markAttendance } from "@/services/attendance";
import { markAllNotificationsRead, markNotificationRead } from "@/services/notifications";
import { saveEvent, unsaveEvent } from "@/services/saved-events";
import { updateStudentProfile } from "@/services/student-profile";
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
  unique,
} from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

async function createStudentFixture() {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const event = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
  });
  const { user, profile } = await createStudent(college.id);

  return {
    college,
    creator,
    club,
    event,
    user,
    profile,
    actor: await actorForUser(user.id),
  };
}

describe("saved events service", () => {
  it("saves an event, is idempotent, and writes an audit entry", async () => {
    const { actor, event, user } = await createStudentFixture();

    const first = await saveEvent(actor, { eventId: event.id });
    const second = await saveEvent(actor, { eventId: event.id });

    expect(second.id).toBe(first.id);
    expect(await prisma.savedEvent.count({ where: { eventId: event.id } })).toBe(1);

    const audits = await prisma.auditLog.findMany({
      where: { action: "SAVED_EVENT_CHANGED", entityId: first.id },
    });
    expect(audits).toHaveLength(2);
    expect(audits[0]?.actorUserId).toBe(user.id);
    expect(audits[0]?.collegeId).toBe(event.collegeId);
  });

  it("unsaves an event and treats a repeated unsave as a no-op", async () => {
    const { actor, event } = await createStudentFixture();

    await saveEvent(actor, { eventId: event.id });
    const removed = await unsaveEvent(actor, { eventId: event.id });
    const removedAgain = await unsaveEvent(actor, { eventId: event.id });

    expect(removed?.eventId).toBe(event.id);
    expect(removedAgain).toBeNull();
    expect(await prisma.savedEvent.count({ where: { eventId: event.id } })).toBe(0);

    const audits = await prisma.auditLog.findMany({
      where: { action: "SAVED_EVENT_CHANGED", entityId: removed?.id },
    });
    expect(audits.some((audit) => (audit.metadata as { saved?: boolean }).saved === false)).toBe(
      true,
    );
  });

  it("rejects saving an event from another college", async () => {
    const { actor } = await createStudentFixture();
    const otherCollege = await createCollege();
    const creator = await createUser({ collegeId: otherCollege.id, role: "CLUB_ADMIN" });
    const otherClub = await createClub({ collegeId: otherCollege.id, createdById: creator.id });
    const otherEvent = await createEvent({
      collegeId: otherCollege.id,
      clubId: otherClub.id,
      createdById: creator.id,
      status: "PUBLISHED",
    });

    await expect(saveEvent(actor, { eventId: otherEvent.id })).rejects.toBeInstanceOf(
      TenantIsolationError,
    );
  });

  it("rejects saving an unpublished event or an event from an inactive club", async () => {
    const { college, creator, club, actor } = await createStudentFixture();
    const draft = await createEvent({
      collegeId: college.id,
      clubId: club.id,
      createdById: creator.id,
      status: "DRAFT",
    });
    const inactiveClub = await createClub({
      collegeId: college.id,
      createdById: creator.id,
      status: "SUSPENDED",
    });
    const inactiveEvent = await createEvent({
      collegeId: college.id,
      clubId: inactiveClub.id,
      createdById: creator.id,
      status: "PUBLISHED",
    });

    await expect(saveEvent(actor, { eventId: draft.id })).rejects.toBeInstanceOf(
      TenantIsolationError,
    );
    await expect(saveEvent(actor, { eventId: inactiveEvent.id })).rejects.toBeInstanceOf(
      TenantIsolationError,
    );
  });

  it("rejects non-students and students without a profile", async () => {
    const { event, college } = await createStudentFixture();
    const admin = await createCollegeAdmin(college.id);
    const adminActor = await actorForUser(admin.id);
    const userWithoutProfile = await createUser({ collegeId: college.id, role: "STUDENT" });
    const actorWithoutProfile = await actorForUser(userWithoutProfile.id);

    await expect(saveEvent(adminActor, { eventId: event.id })).rejects.toBeInstanceOf(
      ActorNotAuthorizedError,
    );
    await expect(saveEvent(actorWithoutProfile, { eventId: event.id })).rejects.toBeInstanceOf(
      ActorNotAuthorizedError,
    );
  });

  it("rejects invalid event IDs without leaking Prisma errors", async () => {
    const { actor } = await createStudentFixture();

    await expect(saveEvent(actor, { eventId: "not-a-uuid" })).rejects.toBeInstanceOf(
      InvalidInputError,
    );
  });
});

describe("student profile service", () => {
  it("updates trusted profile fields and interests, then audits the change", async () => {
    const { actor, user, profile } = await createStudentFixture();
    const interest = await prisma.interest.create({
      data: { name: `Interest ${unique("interest")}`, slug: unique("interest") },
    });

    const updated = await updateStudentProfile(actor, {
      name: "Updated Student",
      rollNumber: "R-2027-01",
      department: "Design",
      graduationYear: 2027,
      bio: "Building things.",
      interestIds: [interest.id],
    });

    expect(updated.rollNumber).toBe("R-2027-01");
    expect(updated.department).toBe("Design");
    expect(updated.interests).toHaveLength(1);

    const savedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(savedUser.name).toBe("Updated Student");

    const savedProfile = await prisma.studentProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: { interests: true },
    });
    expect(savedProfile.interests).toHaveLength(1);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "USER_PROFILE_UPDATED", entityId: profile.id },
    });
    expect(audit?.actorUserId).toBe(user.id);
    expect(audit?.metadata).toMatchObject({ changedFields: expect.arrayContaining(["name"]) });
  });

  it("clears optional fields and interests when empty values are submitted", async () => {
    const { actor, profile } = await createStudentFixture();
    const interest = await prisma.interest.create({
      data: { name: `Interest ${unique("interest")}`, slug: unique("interest") },
    });

    await updateStudentProfile(actor, {
      name: "Still Here",
      rollNumber: "R-1",
      department: "CS",
      graduationYear: 2028,
      bio: "Hello",
      interestIds: [interest.id],
    });

    const updated = await updateStudentProfile(actor, {
      name: "Still Here",
      rollNumber: null,
      department: null,
      graduationYear: null,
      bio: null,
      interestIds: [],
    });

    expect(updated.rollNumber).toBeNull();
    expect(updated.department).toBeNull();
    expect(updated.graduationYear).toBeNull();
    expect(updated.bio).toBeNull();
    expect(updated.interests).toHaveLength(0);
    expect(profile.id).toBe(updated.id);
  });

  it("rejects unavailable interests, invalid years, and non-student actors", async () => {
    const { actor, college } = await createStudentFixture();
    const admin = await createCollegeAdmin(college.id);
    const adminActor = await actorForUser(admin.id);

    await expect(
      updateStudentProfile(actor, {
        name: "Student",
        interestIds: ["00000000-0000-4000-8000-000000000000"],
      }),
    ).rejects.toBeInstanceOf(InvalidInputError);

    await expect(
      updateStudentProfile(actor, {
        name: "Student",
        graduationYear: 1200,
        interestIds: [],
      }),
    ).rejects.toBeInstanceOf(InvalidInputError);

    await expect(
      updateStudentProfile(adminActor, {
        name: "Admin",
        interestIds: [],
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });
});

describe("notification service", () => {
  async function createNotification(userId: string, collegeId: string, title = "Update") {
    return prisma.notification.create({
      data: {
        collegeId,
        userId,
        type: "SYSTEM",
        title,
        body: "A notification body.",
      },
    });
  }

  it("marks a user's notification as read and audits the action", async () => {
    const { college, user, actor } = await createStudentFixture();
    const notification = await createNotification(user.id, college.id);

    const updated = await markNotificationRead(actor, { notificationId: notification.id });

    expect(updated.readAt).not.toBeNull();
    const audit = await prisma.auditLog.findFirst({
      where: { action: "NOTIFICATION_READ", entityId: notification.id },
    });
    expect(audit?.actorUserId).toBe(user.id);
  });

  it("does not allow a user to read another user's notification", async () => {
    const { college, actor } = await createStudentFixture();
    const other = await createStudent(college.id);
    const notification = await createNotification(other.user.id, college.id);

    await expect(
      markNotificationRead(actor, { notificationId: notification.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("marks only the current user's unread notifications as read", async () => {
    const { college, user, actor } = await createStudentFixture();
    const other = await createStudent(college.id);
    const own = await createNotification(user.id, college.id, "Own");
    const otherNotification = await createNotification(other.user.id, college.id, "Other");

    const count = await markAllNotificationsRead(actor);

    expect(count).toBe(1);
    const ownAfter = await prisma.notification.findUniqueOrThrow({ where: { id: own.id } });
    const otherAfter = await prisma.notification.findUniqueOrThrow({
      where: { id: otherNotification.id },
    });
    expect(ownAfter.readAt).not.toBeNull();
    expect(otherAfter.readAt).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "NOTIFICATION_READ", entityId: user.id },
    });
    expect(audit?.metadata).toMatchObject({ count: 1, all: true });
  });

  it("returns zero when there are no unread notifications", async () => {
    const { actor } = await createStudentFixture();

    expect(await markAllNotificationsRead(actor)).toBe(0);
  });
});

describe("attendance service", () => {
  async function createAttendanceFixture() {
    const college = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: creator.id });
    const clubAdmin = await createClubAdmin({ collegeId: college.id, clubId: club.id });
    const collegeAdmin = await createCollegeAdmin(college.id);
    const event = await createEvent({
      collegeId: college.id,
      clubId: club.id,
      createdById: creator.id,
      status: "PUBLISHED",
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const { user: student, profile } = await createStudent(college.id);
    const registration = await prisma.eventRegistration.create({
      data: {
        collegeId: college.id,
        eventId: event.id,
        studentProfileId: profile.id,
        status: "CONFIRMED",
      },
    });

    return {
      college,
      club,
      clubAdmin,
      collegeAdmin,
      event,
      student,
      profile,
      registration,
      clubActor: await actorForUser(clubAdmin.id),
      collegeActor: await actorForUser(collegeAdmin.id),
      studentActor: await actorForUser(student.id),
    };
  }

  it("lets a club manager record attendance after the event starts", async () => {
    const { registration, clubActor } = await createAttendanceFixture();

    const updated = await markAttendance(clubActor, {
      registrationId: registration.id,
      status: "ATTENDED",
    });

    expect(updated.status).toBe("ATTENDED");
    expect(updated.checkedInAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "REGISTRATION_STATUS_CHANGED", entityId: registration.id },
    });
    expect(audit?.metadata).toMatchObject({ to: "ATTENDED" });
  });

  it("lets a college administrator record a no-show", async () => {
    const { registration, collegeActor } = await createAttendanceFixture();

    const updated = await markAttendance(collegeActor, {
      registrationId: registration.id,
      status: "NO_SHOW",
    });

    expect(updated.status).toBe("NO_SHOW");
    expect(updated.checkedInAt).toBeNull();
  });

  it("rejects students, cross-college registrations, and missing registrations", async () => {
    const { registration, studentActor, college } = await createAttendanceFixture();
    const otherCollege = await createCollege();
    const otherCreator = await createUser({
      collegeId: otherCollege.id,
      role: "CLUB_ADMIN",
    });
    const otherClub = await createClub({
      collegeId: otherCollege.id,
      createdById: otherCreator.id,
    });
    const otherAdmin = await createCollegeAdmin(otherCollege.id);
    const otherAdminActor = await actorForUser(otherAdmin.id);

    await expect(
      markAttendance(studentActor, { registrationId: registration.id, status: "ATTENDED" }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    await expect(
      markAttendance(otherAdminActor, { registrationId: registration.id, status: "ATTENDED" }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    await expect(
      markAttendance(otherAdminActor, {
        registrationId: "00000000-0000-4000-8000-000000000000",
        status: "ATTENDED",
      }),
    ).rejects.toBeInstanceOf(TenantIsolationError);

    expect(await prisma.club.count({ where: { id: otherClub.id } })).toBe(1);
    expect(await prisma.college.count({ where: { id: college.id } })).toBe(1);
  });

  it("rejects attendance before the event starts", async () => {
    const { event, registration, clubActor } = await createAttendanceFixture();
    await prisma.event.update({
      where: { id: event.id },
      data: {
        startsAt: new Date(Date.now() + 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });

    await expect(
      markAttendance(clubActor, { registrationId: registration.id, status: "ATTENDED" }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("rejects invalid attendance transitions and events that are not published", async () => {
    const { event, registration, clubActor } = await createAttendanceFixture();
    await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { status: "ATTENDED", checkedInAt: new Date() },
    });

    await expect(
      markAttendance(clubActor, { registrationId: registration.id, status: "NO_SHOW" }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

    await prisma.event.update({ where: { id: event.id }, data: { status: "DRAFT" } });
    await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { status: "CONFIRMED", checkedInAt: null },
    });

    await expect(
      markAttendance(clubActor, { registrationId: registration.id, status: "ATTENDED" }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("rejects invalid registration IDs with a safe input error", async () => {
    const { clubActor } = await createAttendanceFixture();

    await expect(
      markAttendance(clubActor, { registrationId: "bad-id", status: "ATTENDED" }),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("allows a platform administrator to record attendance across colleges", async () => {
    const { registration } = await createAttendanceFixture();
    const superAdmin = await createSuperAdmin();
    const superAdminActor = await actorForUser(superAdmin.id);

    const updated = await markAttendance(superAdminActor, {
      registrationId: registration.id,
      status: "ATTENDED",
    });

    expect(updated.status).toBe("ATTENDED");
  });
});

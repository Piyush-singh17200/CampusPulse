import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { ActorNotAuthorizedError, DomainError, InvalidTransitionError } from "@/server/errors";
import { correctAttendance, issueAttendanceQr, scanAttendance } from "@/services/attendance";
import { resetDatabase } from "@tests/helpers/db";
import {
  actorForUser,
  createClub,
  createClubAdmin,
  createCollege,
  createEvent,
  createStudent,
  createUser,
} from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

async function createAttendanceFixture() {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const manager = await createClubAdmin({ collegeId: college.id, clubId: club.id });
  const { user: student, profile } = await createStudent(college.id);
  const now = Date.now();
  const event = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt: new Date(now - 30 * 60 * 1000),
    endsAt: new Date(now + 60 * 60 * 1000),
  });
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
    creator,
    club,
    manager,
    student,
    profile,
    event,
    registration,
    managerActor: await actorForUser(manager.id),
    studentActor: await actorForUser(student.id),
  };
}

describe("Prompt 8 QR attendance", () => {
  it("issues a registration-bound QR and records a valid check-in with audit and notification", async () => {
    const fixture = await createAttendanceFixture();
    const issued = await issueAttendanceQr(fixture.studentActor, fixture.registration.id);

    expect(issued.payload).toMatch(/^campuspulse-attendance:v1:/);
    const credential = await prisma.attendanceCredential.findUniqueOrThrow({
      where: { registrationId: fixture.registration.id },
    });
    expect(credential.tokenHash).not.toContain(issued.payload);
    expect(credential.eventId).toBe(fixture.event.id);

    const result = await scanAttendance(fixture.managerActor, {
      eventId: fixture.event.id,
      token: issued.payload,
    });

    expect(result.studentName).toBeTruthy();
    expect(result.eventTitle).toBe(fixture.event.title);
    const registration = await prisma.eventRegistration.findUniqueOrThrow({
      where: { id: fixture.registration.id },
    });
    expect(registration.status).toBe("ATTENDED");
    expect(registration.checkedInAt).not.toBeNull();

    const notification = await prisma.notification.findFirst({
      where: { userId: fixture.student.id, type: "ATTENDANCE_UPDATE" },
    });
    expect(notification?.actionUrl).toBe("/student/registrations");

    const audits = await prisma.auditLog.findMany({
      where: { entityId: { in: [credential.id, fixture.registration.id] } },
    });
    expect(audits.some((audit) => audit.action === "ATTENDANCE_CREDENTIAL_ISSUED")).toBe(true);
    expect(audits.some((audit) => audit.action === "ATTENDANCE_RECORDED")).toBe(true);
  });

  it("rejects invalid, duplicate, wrong-event, expired, and revoked credentials", async () => {
    const fixture = await createAttendanceFixture();

    await expect(
      scanAttendance(fixture.managerActor, {
        eventId: fixture.event.id,
        token: "cp_att_not-a-real-token",
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const issued = await issueAttendanceQr(fixture.studentActor, fixture.registration.id);
    await scanAttendance(fixture.managerActor, {
      eventId: fixture.event.id,
      token: issued.payload,
    });
    await expect(
      scanAttendance(fixture.managerActor, {
        eventId: fixture.event.id,
        token: issued.payload,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const secondEvent = await createEvent({
      collegeId: fixture.college.id,
      clubId: fixture.club.id,
      createdById: fixture.creator.id,
      status: "PUBLISHED",
      startsAt: new Date(Date.now() - 30 * 60 * 1000),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const { user: secondStudent, profile: secondProfile } = await createStudent(fixture.college.id);
    const secondRegistration = await prisma.eventRegistration.create({
      data: {
        collegeId: fixture.college.id,
        eventId: secondEvent.id,
        studentProfileId: secondProfile.id,
        status: "CONFIRMED",
      },
    });
    const secondActor = await actorForUser(secondStudent.id);
    const secondIssued = await issueAttendanceQr(secondActor, secondRegistration.id);

    await expect(
      scanAttendance(fixture.managerActor, {
        eventId: fixture.event.id,
        token: secondIssued.payload,
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    await prisma.attendanceCredential.update({
      where: { registrationId: secondRegistration.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      scanAttendance(fixture.managerActor, {
        eventId: secondEvent.id,
        token: secondIssued.payload,
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    await prisma.attendanceCredential.update({
      where: { registrationId: secondRegistration.id },
      data: { expiresAt: new Date(Date.now() + 60 * 60 * 1000), revokedAt: new Date() },
    });
    await expect(
      scanAttendance(fixture.managerActor, {
        eventId: secondEvent.id,
        token: secondIssued.payload,
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("rejects cancelled registrations and cross-college or unauthorized scanners", async () => {
    const fixture = await createAttendanceFixture();
    const issued = await issueAttendanceQr(fixture.studentActor, fixture.registration.id);

    await expect(
      scanAttendance(fixture.studentActor, {
        eventId: fixture.event.id,
        token: issued.payload,
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

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

    await expect(
      scanAttendance(otherManagerActor, {
        eventId: fixture.event.id,
        token: issued.payload,
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    await prisma.eventRegistration.update({
      where: { id: fixture.registration.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await expect(
      scanAttendance(fixture.managerActor, {
        eventId: fixture.event.id,
        token: issued.payload,
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("rejects a QR code issued for another college", async () => {
    const fixture = await createAttendanceFixture();
    const otherCollege = await createCollege();
    const otherCreator = await createUser({
      collegeId: otherCollege.id,
      role: "CLUB_ADMIN",
    });
    const otherClub = await createClub({
      collegeId: otherCollege.id,
      createdById: otherCreator.id,
    });
    const otherEvent = await createEvent({
      collegeId: otherCollege.id,
      clubId: otherClub.id,
      createdById: otherCreator.id,
      status: "PUBLISHED",
      startsAt: new Date(Date.now() - 30 * 60 * 1000),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const { user: otherStudent, profile: otherProfile } = await createStudent(otherCollege.id);
    const otherRegistration = await prisma.eventRegistration.create({
      data: {
        collegeId: otherCollege.id,
        eventId: otherEvent.id,
        studentProfileId: otherProfile.id,
        status: "CONFIRMED",
      },
    });
    const otherStudentActor = await actorForUser(otherStudent.id);
    const issued = await issueAttendanceQr(otherStudentActor, otherRegistration.id);

    await expect(
      scanAttendance(fixture.managerActor, {
        eventId: otherEvent.id,
        token: issued.payload,
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("allows only one winner in a concurrent duplicate check-in", async () => {
    const fixture = await createAttendanceFixture();
    const issued = await issueAttendanceQr(fixture.studentActor, fixture.registration.id);

    const results = await Promise.allSettled([
      scanAttendance(fixture.managerActor, {
        eventId: fixture.event.id,
        token: issued.payload,
      }),
      scanAttendance(fixture.managerActor, {
        eventId: fixture.event.id,
        token: issued.payload,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const registration = await prisma.eventRegistration.findUniqueOrThrow({
      where: { id: fixture.registration.id },
    });
    expect(registration.status).toBe("ATTENDED");
  });

  it("records manual corrections only with a reason and preserves audit history", async () => {
    const fixture = await createAttendanceFixture();
    await expect(
      correctAttendance(fixture.managerActor, {
        registrationId: fixture.registration.id,
        status: "NO_SHOW",
        reason: "",
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const noShow = await correctAttendance(fixture.managerActor, {
      registrationId: fixture.registration.id,
      status: "NO_SHOW",
      reason: "Student did not reach the venue.",
    });
    expect(noShow.status).toBe("NO_SHOW");
    expect(noShow.checkedInAt).toBeNull();

    const attended = await correctAttendance(fixture.managerActor, {
      registrationId: fixture.registration.id,
      status: "ATTENDED",
      reason: "Student arrived after the first roll call.",
    });
    expect(attended.status).toBe("ATTENDED");

    const audits = await prisma.auditLog.findMany({
      where: { entityId: fixture.registration.id },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.some((audit) => audit.action === "ATTENDANCE_CORRECTED")).toBe(true);
    expect(
      audits.some(
        (audit) =>
          (audit.metadata as { reason?: string }).reason ===
          "Student arrived after the first roll call.",
      ),
    ).toBe(true);
  });
});

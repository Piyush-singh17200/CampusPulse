import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { InvalidTransitionError } from "@/server/errors";
import { transitionEvent } from "@/services/events";
import { cancelRegistration, registerForEvent } from "@/services/registrations";
import { resetDatabase } from "@tests/helpers/db";
import {
  actorForUser,
  createClub,
  createClubAdmin,
  createCollege,
  createCollegeAdmin,
  createEvent,
  createStudent,
  createUser,
} from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

async function createNotificationFixture() {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const president = await createClubAdmin({ collegeId: college.id, clubId: club.id });
  const officer = await createClubAdmin({
    collegeId: college.id,
    clubId: club.id,
    membershipRole: "OFFICER",
  });
  const member = await createClubAdmin({
    collegeId: college.id,
    clubId: club.id,
    membershipRole: "MEMBER",
  });
  const disabledManager = await createClubAdmin({ collegeId: college.id, clubId: club.id });
  await prisma.user.update({
    where: { id: disabledManager.id },
    data: { status: "DISABLED" },
  });

  const otherClubCreator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const otherClub = await createClub({
    collegeId: college.id,
    createdById: otherClubCreator.id,
  });
  const otherClubManager = await createClubAdmin({
    collegeId: college.id,
    clubId: otherClub.id,
  });

  const otherCollege = await createCollege();
  const otherCollegeCreator = await createUser({
    collegeId: otherCollege.id,
    role: "CLUB_ADMIN",
  });
  const otherCollegeClub = await createClub({
    collegeId: otherCollege.id,
    createdById: otherCollegeCreator.id,
  });
  const otherCollegeManager = await createClubAdmin({
    collegeId: otherCollege.id,
    clubId: otherCollegeClub.id,
  });

  const collegeAdmin = await createCollegeAdmin(college.id);
  const event = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "DRAFT",
  });

  return {
    college,
    club,
    event,
    president,
    officer,
    member,
    disabledManager,
    otherClubManager,
    otherCollegeManager,
    collegeAdmin,
    presidentActor: await actorForUser(president.id),
    collegeAdminActor: await actorForUser(collegeAdmin.id),
  };
}

async function moderationNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId, type: "MODERATION_UPDATE" },
    orderBy: { createdAt: "asc" },
  });
}

async function registrationNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId, type: "REGISTRATION_UPDATE" },
    orderBy: { createdAt: "asc" },
  });
}

describe("event notifications", () => {
  it("notifies active president and officer managers once when an event is approved", async () => {
    const fixture = await createNotificationFixture();
    const {
      event,
      club,
      president,
      officer,
      member,
      disabledManager,
      otherClubManager,
      otherCollegeManager,
    } = fixture;

    await transitionEvent(fixture.presidentActor, {
      eventId: event.id,
      to: "PENDING_APPROVAL",
    });
    await transitionEvent(fixture.collegeAdminActor, {
      eventId: event.id,
      to: "PUBLISHED",
    });

    const presidentNotifications = await moderationNotifications(president.id);
    const officerNotifications = await moderationNotifications(officer.id);

    expect(presidentNotifications).toHaveLength(1);
    expect(officerNotifications).toHaveLength(1);
    expect(presidentNotifications[0]).toMatchObject({
      collegeId: event.collegeId,
      type: "MODERATION_UPDATE",
      title: "Event approved",
      actionUrl: `/club/events/${event.id}?club=${club.id}`,
    });
    expect(presidentNotifications[0]?.body).toContain(event.title);

    for (const userId of [
      member.id,
      disabledManager.id,
      otherClubManager.id,
      otherCollegeManager.id,
      fixture.collegeAdmin.id,
    ]) {
      await expect(moderationNotifications(userId)).resolves.toHaveLength(0);
    }

    const total = await prisma.notification.count({ where: { type: "MODERATION_UPDATE" } });
    expect(total).toBe(2);
  });

  it("includes the rejection reason in manager notifications and does not duplicate on retry", async () => {
    const fixture = await createNotificationFixture();
    const { event, president } = fixture;
    const reason = "The accessibility plan needs a clear contact and step-free route.";

    await transitionEvent(fixture.presidentActor, {
      eventId: event.id,
      to: "PENDING_APPROVAL",
    });
    await transitionEvent(fixture.collegeAdminActor, {
      eventId: event.id,
      to: "REJECTED",
      reason,
    });

    const notifications = await moderationNotifications(president.id);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.title).toBe("Event needs changes");
    expect(notifications[0]?.body).toContain(reason);

    await expect(
      transitionEvent(fixture.collegeAdminActor, {
        eventId: event.id,
        to: "REJECTED",
        reason,
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    await expect(moderationNotifications(president.id)).resolves.toHaveLength(1);
  });

  it("notifies only confirmed registered students when an event is cancelled", async () => {
    const fixture = await createNotificationFixture();
    const { college, event, club } = fixture;
    const { user: confirmedStudent, profile: confirmedProfile } = await createStudent(college.id);
    const { user: cancelledStudent, profile: cancelledProfile } = await createStudent(college.id);
    const { user: otherStudent } = await createStudent(college.id);

    await prisma.event.update({
      where: { id: event.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    await prisma.eventRegistration.create({
      data: {
        collegeId: event.collegeId,
        eventId: event.id,
        studentProfileId: confirmedProfile.id,
        status: "CONFIRMED",
      },
    });
    await prisma.eventRegistration.create({
      data: {
        collegeId: event.collegeId,
        eventId: event.id,
        studentProfileId: cancelledProfile.id,
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    await transitionEvent(fixture.collegeAdminActor, {
      eventId: event.id,
      to: "CANCELLED",
      reason: "Venue unavailable",
    });

    const confirmedNotifications = await registrationNotifications(confirmedStudent.id);
    expect(confirmedNotifications).toHaveLength(1);
    expect(confirmedNotifications[0]).toMatchObject({
      collegeId: event.collegeId,
      title: "Event cancelled",
      actionUrl: "/student/registrations",
    });
    expect(confirmedNotifications[0]?.body).toContain("Venue unavailable");

    await expect(registrationNotifications(cancelledStudent.id)).resolves.toHaveLength(0);
    await expect(registrationNotifications(otherStudent.id)).resolves.toHaveLength(0);
    await expect(moderationNotifications(fixture.president.id)).resolves.toHaveLength(0);

    await expect(
      transitionEvent(fixture.collegeAdminActor, {
        eventId: event.id,
        to: "CANCELLED",
        reason: "Venue unavailable",
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    await expect(registrationNotifications(confirmedStudent.id)).resolves.toHaveLength(1);

    expect(club.id).toBeTruthy();
  });

  it("notifies the student once for registration confirmation and once for cancellation", async () => {
    const fixture = await createNotificationFixture();
    const { college, event } = fixture;
    const { user: student } = await createStudent(college.id);
    const studentActor = await actorForUser(student.id);

    await prisma.event.update({
      where: { id: event.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    await registerForEvent(studentActor, { eventId: event.id });

    const afterRegistration = await registrationNotifications(student.id);
    expect(afterRegistration).toHaveLength(1);
    expect(afterRegistration[0]).toMatchObject({
      collegeId: event.collegeId,
      title: "Registration confirmed",
      actionUrl: `/student/events/${event.id}`,
    });
    expect(afterRegistration[0]?.body).toContain(event.title);

    await expect(registerForEvent(studentActor, { eventId: event.id })).rejects.toMatchObject({
      code: "ALREADY_REGISTERED",
    });
    await expect(registrationNotifications(student.id)).resolves.toHaveLength(1);

    await cancelRegistration(studentActor, { eventId: event.id });

    const afterCancellation = await registrationNotifications(student.id);
    expect(afterCancellation).toHaveLength(2);
    const cancellation = await prisma.notification.findFirst({
      where: { userId: student.id, title: "Registration cancelled" },
    });
    expect(cancellation).toMatchObject({
      actionUrl: `/student/events/${event.id}`,
    });

    await expect(cancelRegistration(studentActor, { eventId: event.id })).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
    await expect(registrationNotifications(student.id)).resolves.toHaveLength(2);

    await expect(moderationNotifications(fixture.president.id)).resolves.toHaveLength(0);
  });
});

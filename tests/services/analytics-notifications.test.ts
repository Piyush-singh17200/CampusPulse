import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { createNotifications } from "@/server/db/notifications";
import { runInTransaction } from "@/server/db/transactions";
import { ActorNotAuthorizedError, DomainError, TenantIsolationError } from "@/server/errors";
import {
  getClubEngagementAnalytics,
  getCollegeEngagementAnalytics,
  getPlatformEngagementAnalytics,
} from "@/server/dashboards/engagement-analytics";
import { getClubFeedback } from "@/server/dashboards/feedback";
import { getStudentNotifications } from "@/server/dashboards/queries";
import {
  defaultNotificationPreferences,
  getNotificationPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "@/services/notifications";
import { resetDatabase } from "@tests/helpers/db";
import {
  actorForUser,
  createCategory,
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

async function createAnalyticsFixture() {
  const college = await createCollege({ name: "Northfield Institute", shortName: "NFI" });
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({
    collegeId: college.id,
    createdById: creator.id,
    name: "Robotics Club",
  });
  const manager = await createClubAdmin({ collegeId: college.id, clubId: club.id });
  const collegeAdmin = await createCollegeAdmin(college.id);
  const superAdmin = await createSuperAdmin();
  const category = await createCategory(college.id);
  const now = Date.now();
  const completed = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "COMPLETED",
    startsAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
    endsAt: new Date(now - 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
  });
  await prisma.eventCategory.create({
    data: { collegeId: college.id, eventId: completed.id, categoryId: category.id },
  });
  const published = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt: new Date(now - 24 * 60 * 60 * 1000),
    endsAt: new Date(now + 60 * 60 * 1000),
  });
  const outside = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "COMPLETED",
    startsAt: new Date(now - 365 * 24 * 60 * 60 * 1000),
    endsAt: new Date(now - 365 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
  });

  const students = await Promise.all([
    createStudent(college.id),
    createStudent(college.id),
    createStudent(college.id),
    createStudent(college.id),
  ]);

  await prisma.eventRegistration.createMany({
    data: [
      {
        collegeId: college.id,
        eventId: completed.id,
        studentProfileId: students[0].profile.id,
        status: "ATTENDED",
        checkedInAt: completed.startsAt,
      },
      {
        collegeId: college.id,
        eventId: completed.id,
        studentProfileId: students[1].profile.id,
        status: "CONFIRMED",
      },
      {
        collegeId: college.id,
        eventId: completed.id,
        studentProfileId: students[2].profile.id,
        status: "NO_SHOW",
      },
      {
        collegeId: college.id,
        eventId: completed.id,
        studentProfileId: students[3].profile.id,
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
      {
        collegeId: college.id,
        eventId: published.id,
        studentProfileId: students[0].profile.id,
        status: "CONFIRMED",
      },
      {
        collegeId: college.id,
        eventId: outside.id,
        studentProfileId: students[1].profile.id,
        status: "ATTENDED",
        checkedInAt: outside.startsAt,
      },
    ],
  });
  await prisma.eventFeedback.createMany({
    data: [
      {
        collegeId: college.id,
        eventId: completed.id,
        studentProfileId: students[0].profile.id,
        rating: 5,
        comment: "Excellent.",
        moderationStatus: "VISIBLE",
      },
      {
        collegeId: college.id,
        eventId: completed.id,
        studentProfileId: students[1].profile.id,
        rating: 3,
        comment: "Good.",
        moderationStatus: "VISIBLE",
      },
      {
        collegeId: college.id,
        eventId: completed.id,
        studentProfileId: students[2].profile.id,
        rating: 1,
        comment: "Hidden.",
        moderationStatus: "HIDDEN",
      },
    ],
  });

  return {
    college,
    creator,
    club,
    manager,
    collegeAdmin,
    superAdmin,
    category,
    completed,
    published,
    outside,
    students,
    managerActor: await actorForUser(manager.id),
    collegeAdminActor: await actorForUser(collegeAdmin.id),
    superAdminActor: await actorForUser(superAdmin.id),
  };
}

describe("Engagement analytics", () => {
  it("derives club metrics, rates, trends, and visible-feedback averages from real rows", async () => {
    const fixture = await createAnalyticsFixture();
    const data = await getClubEngagementAnalytics(fixture.managerActor, fixture.club.id);

    expect(data.club?.id).toBe(fixture.club.id);
    expect(data.totalEvents).toBe(2);
    expect(data.publishedEvents).toBe(1);
    expect(data.completedEvents).toBe(1);
    expect(data.pendingApprovals).toBe(0);
    expect(data.totalRegistrations).toBe(5);
    expect(data.activeRegistrations).toBe(3);
    expect(data.cancelledRegistrations).toBe(1);
    expect(data.attendedRegistrations).toBe(1);
    expect(data.noShowRegistrations).toBe(1);
    expect(data.eligibleRegistrations).toBe(4);
    expect(data.attendanceRate).toBe(25);
    expect(data.eventCompletionRate).toBe(50);
    expect(data.averageRating).toBe(4);
    expect(data.feedbackResponseCount).toBe(2);
    expect(data.feedbackDistribution).toEqual([
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 1 },
      { rating: 4, count: 0 },
      { rating: 5, count: 1 },
    ]);
    expect(data.categoryBreakdown).toEqual([{ name: "Test Category", count: 1 }]);

    const completed = data.eventBreakdown.find((event) => event.id === fixture.completed.id);
    expect(completed).toMatchObject({
      totalRegistrations: 4,
      activeRegistrations: 2,
      cancelledRegistrations: 1,
      attended: 1,
      noShow: 1,
      eligible: 3,
      attendanceRate: 33.3,
      averageRating: 4,
      feedbackCount: 2,
    });
    expect(data.eventMonths.length).toBeGreaterThan(0);
    expect(data.registrationMonths.length).toBeGreaterThan(0);
    expect(data.attendanceMonths).toHaveLength(1);
    expect(data.lowAttendanceEvents.map((event) => event.id)).toContain(fixture.completed.id);
  });

  it("applies event, category, date, and status filters without fabricating data", async () => {
    const fixture = await createAnalyticsFixture();
    const byEvent = await getClubEngagementAnalytics(fixture.managerActor, fixture.club.id, {
      eventId: fixture.published.id,
    });
    expect(byEvent.totalEvents).toBe(1);
    expect(byEvent.totalRegistrations).toBe(1);
    expect(byEvent.averageRating).toBeNull();
    expect(byEvent.eventBreakdown[0]?.id).toBe(fixture.published.id);

    const byCategory = await getClubEngagementAnalytics(fixture.managerActor, fixture.club.id, {
      category: fixture.category.slug,
    });
    expect(byCategory.totalEvents).toBe(1);
    expect(byCategory.eventBreakdown[0]?.id).toBe(fixture.completed.id);

    const byStatus = await getClubEngagementAnalytics(fixture.managerActor, fixture.club.id, {
      status: "PUBLISHED",
    });
    expect(byStatus.totalEvents).toBe(1);
    expect(byStatus.publishedEvents).toBe(1);
    expect(byStatus.completedEvents).toBe(0);

    const empty = await getClubEngagementAnalytics(fixture.managerActor, fixture.club.id, {
      from: "2020-01-01",
      to: "2020-01-31",
    });
    expect(empty.totalEvents).toBe(0);
    expect(empty.totalRegistrations).toBe(0);
    expect(empty.attendanceRate).toBeNull();
    expect(empty.averageRating).toBeNull();
    expect(empty.eventBreakdown).toEqual([]);
  });

  it("groups clubs by ID even when display names collide", async () => {
    const fixture = await createAnalyticsFixture();
    const sameNameClub = await createClub({
      collegeId: fixture.college.id,
      createdById: fixture.creator.id,
      name: "Robotics Club",
    });
    await createEvent({
      collegeId: fixture.college.id,
      clubId: sameNameClub.id,
      createdById: fixture.creator.id,
      status: "PUBLISHED",
      startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const data = await getCollegeEngagementAnalytics(fixture.collegeAdminActor);
    const roboticsRows = data.clubActivity.filter((row) => row.name === "Robotics Club");

    expect(roboticsRows).toHaveLength(2);
    expect(roboticsRows.map((row) => row.count).sort((left, right) => left - right)).toEqual([
      1, 2,
    ]);
  });

  it("scopes a selected old event outside the default date window", async () => {
    const fixture = await createAnalyticsFixture();
    const data = await getClubEngagementAnalytics(fixture.managerActor, fixture.club.id, {
      eventId: fixture.outside.id,
    });

    expect(data.totalEvents).toBe(1);
    expect(data.eventBreakdown.map((event) => event.id)).toEqual([fixture.outside.id]);
    expect(data.totalRegistrations).toBe(1);
    expect(data.eventOptions.some((event) => event.id === fixture.outside.id)).toBe(true);
  });

  it("resolves a feedback event outside the latest 100 event options", async () => {
    const fixture = await createAnalyticsFixture();
    const oldStartsAt = new Date(Date.now() - 500 * 24 * 60 * 60 * 1000);
    const oldEvent = await prisma.event.create({
      data: {
        collegeId: fixture.college.id,
        clubId: fixture.club.id,
        createdById: fixture.creator.id,
        title: "Old feedback event",
        slug: "old-feedback-event",
        status: "COMPLETED",
        startsAt: oldStartsAt,
        endsAt: new Date(oldStartsAt.getTime() + 2 * 60 * 60 * 1000),
        venueName: "Old Hall",
        publishedAt: new Date(),
        completedAt: new Date(),
      },
    });

    await prisma.event.createMany({
      data: Array.from({ length: 105 }, (_, index) => {
        const startsAt = new Date(Date.now() - (index + 2) * 24 * 60 * 60 * 1000);
        return {
          collegeId: fixture.college.id,
          clubId: fixture.club.id,
          createdById: fixture.creator.id,
          title: `Recent feedback event ${index}`,
          slug: `recent-feedback-event-${index}`,
          status: "COMPLETED" as const,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
          venueName: "Recent Hall",
          publishedAt: new Date(),
          completedAt: new Date(),
        };
      }),
    });

    const data = await getClubFeedback(fixture.managerActor, fixture.club.id, {
      eventId: oldEvent.id,
    });

    expect(data.selectedEvent?.id).toBe(oldEvent.id);
    expect(data.events.some((event) => event.id === oldEvent.id)).toBe(true);
  });

  it("enforces club, college, and platform tenant boundaries", async () => {
    const fixture = await createAnalyticsFixture();
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
      getClubEngagementAnalytics(otherManagerActor, fixture.club.id),
    ).rejects.toBeInstanceOf(TenantIsolationError);

    const otherAdmin = await createCollegeAdmin(otherCollege.id);
    const otherAdminActor = await actorForUser(otherAdmin.id);
    const otherCollegeData = await getCollegeEngagementAnalytics(otherAdminActor);
    expect(otherCollegeData.totalEvents).toBe(0);
    expect(otherCollegeData.college.id).toBe(otherCollege.id);

    const collegeData = await getCollegeEngagementAnalytics(fixture.collegeAdminActor);
    expect(collegeData.totalEvents).toBe(2);
    expect(collegeData.clubActivity).toEqual([{ name: "Robotics Club", count: 2 }]);

    await expect(
      getCollegeEngagementAnalytics(fixture.collegeAdminActor, { clubId: otherClub.id }),
    ).rejects.toBeInstanceOf(TenantIsolationError);

    await expect(getPlatformEngagementAnalytics(fixture.collegeAdminActor)).rejects.toBeInstanceOf(
      ActorNotAuthorizedError,
    );
    const platformData = await getPlatformEngagementAnalytics(fixture.superAdminActor);
    expect(platformData.activeColleges).toBeGreaterThanOrEqual(2);
    expect(platformData.totalEvents).toBeGreaterThanOrEqual(2);
    expect(platformData.collegeActivity.some((row) => row.name === "Northfield Institute")).toBe(
      true,
    );

    const publishedPlatformData = await getPlatformEngagementAnalytics(fixture.superAdminActor, {
      from: "2020-01-01",
      to: "2030-01-01",
      status: "PUBLISHED",
    });
    expect(publishedPlatformData.totalEvents).toBe(1);
    expect(publishedPlatformData.publishedEvents).toBe(1);
    expect(publishedPlatformData.completedEvents).toBe(0);
    expect(publishedPlatformData.totalRegistrations).toBe(1);
    expect(publishedPlatformData.attendedRegistrations).toBe(0);
    expect(publishedPlatformData.feedbackResponseCount).toBe(0);
    expect(publishedPlatformData.eventStatusCounts).toEqual([{ status: "PUBLISHED", count: 1 }]);
  });
});

describe("Notifications", () => {
  async function createNotificationFixture() {
    const college = await createCollege();
    const { user: student } = await createStudent(college.id, { name: "Student One" });
    const { user: otherStudent } = await createStudent(college.id, { name: "Student Two" });
    const otherCollege = await createCollege();
    const { user: outsider } = await createStudent(otherCollege.id);

    await prisma.notification.createMany({
      data: [
        {
          collegeId: college.id,
          userId: student.id,
          type: "REGISTRATION_UPDATE",
          title: "Registration confirmed",
          body: "Your place is confirmed.",
          actionUrl: "/student/registrations",
        },
        {
          collegeId: college.id,
          userId: student.id,
          type: "ATTENDANCE_UPDATE",
          title: "Attendance recorded",
          body: "You checked in.",
          actionUrl: "/student/registrations",
          readAt: new Date(),
        },
        {
          collegeId: college.id,
          userId: student.id,
          type: "FEEDBACK_UPDATE",
          title: "Feedback is open",
          body: "Share your experience.",
          actionUrl: "//evil.example/phish",
        },
        {
          collegeId: college.id,
          userId: student.id,
          type: "SYSTEM",
          title: "System message",
          body: "A platform notice.",
          actionUrl: null,
        },
        {
          collegeId: college.id,
          userId: otherStudent.id,
          type: "REGISTRATION_UPDATE",
          title: "Other student's notification",
          body: "Must not appear.",
          actionUrl: "/student/registrations",
        },
      ],
    });

    return {
      college,
      otherCollege,
      student,
      otherStudent,
      outsider,
      studentActor: await actorForUser(student.id),
      otherStudentActor: await actorForUser(otherStudent.id),
      outsiderActor: await actorForUser(outsider.id),
    };
  }

  it("paginates, filters, counts by type, and isolates notifications by user", async () => {
    const fixture = await createNotificationFixture();
    const firstPage = await getStudentNotifications(fixture.studentActor, { pageSize: 2 });

    expect(firstPage.total).toBe(4);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.notifications).toHaveLength(2);
    expect(firstPage.unread).toBe(3);
    expect(firstPage.typeCounts).toEqual(
      expect.arrayContaining([
        { type: "REGISTRATION_UPDATE", count: 1 },
        { type: "ATTENDANCE_UPDATE", count: 1 },
        { type: "FEEDBACK_UPDATE", count: 1 },
        { type: "SYSTEM", count: 1 },
      ]),
    );
    expect(firstPage.notifications.every((row) => row.userId === fixture.student.id)).toBe(true);

    const allNotifications = await getStudentNotifications(fixture.studentActor, {
      pageSize: 10,
    });
    expect(
      allNotifications.notifications.find((row) => row.type === "FEEDBACK_UPDATE")?.actionUrl,
    ).toBe(null);
    expect(
      allNotifications.notifications.find((row) => row.type === "REGISTRATION_UPDATE")?.actionUrl,
    ).toBe("/student/registrations");

    const secondPage = await getStudentNotifications(fixture.studentActor, {
      pageSize: 2,
      page: 2,
    });
    expect(secondPage.notifications).toHaveLength(2);
    expect(secondPage.page).toBe(2);

    const unread = await getStudentNotifications(fixture.studentActor, {
      filter: "unread",
      pageSize: 10,
    });
    expect(unread.total).toBe(3);
    expect(unread.notifications.every((row) => row.readAt === null)).toBe(true);
    expect(unread.typeCounts).toEqual(
      expect.arrayContaining([
        { type: "REGISTRATION_UPDATE", count: 1 },
        { type: "FEEDBACK_UPDATE", count: 1 },
        { type: "SYSTEM", count: 1 },
      ]),
    );
    expect(unread.typeCounts).not.toContainEqual({ type: "ATTENDANCE_UPDATE", count: 1 });

    const clamped = await getStudentNotifications(fixture.studentActor, {
      page: 999,
      pageSize: 2,
    });
    expect(clamped.page).toBe(2);
    expect(clamped.notifications).toHaveLength(2);

    const byType = await getStudentNotifications(fixture.studentActor, {
      type: "FEEDBACK_UPDATE",
      pageSize: 10,
    });
    expect(byType.total).toBe(1);
    expect(byType.filters).toEqual({ filter: "all", type: "FEEDBACK_UPDATE" });

    const invalidType = await getStudentNotifications(fixture.studentActor, {
      type: "NOT_A_TYPE",
      pageSize: 10,
    });
    expect(invalidType.total).toBe(4);

    const otherStudentData = await getStudentNotifications(fixture.otherStudentActor, {
      pageSize: 10,
    });
    expect(otherStudentData.total).toBe(1);
    expect(otherStudentData.notifications[0]?.title).toBe("Other student's notification");

    const outsiderData = await getStudentNotifications(fixture.outsiderActor, { pageSize: 10 });
    expect(outsiderData.total).toBe(0);
  });

  it("marks only the caller's notifications read and audits bulk reads", async () => {
    const fixture = await createNotificationFixture();
    const first = await prisma.notification.findFirstOrThrow({
      where: { userId: fixture.student.id, readAt: null },
    });

    await expect(
      markNotificationRead(fixture.otherStudentActor, { notificationId: first.id }),
    ).rejects.toBeInstanceOf(DomainError);

    const marked = await markNotificationRead(fixture.studentActor, {
      notificationId: first.id,
    });
    expect(marked.readAt).not.toBeNull();

    const count = await markAllNotificationsRead(fixture.studentActor);
    expect(count).toBe(2);
    const remaining = await prisma.notification.count({
      where: { userId: fixture.student.id, readAt: null },
    });
    expect(remaining).toBe(0);

    const audits = await prisma.auditLog.findMany({
      where: { actorUserId: fixture.student.id, action: "NOTIFICATION_READ" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
    expect(audits.some((audit) => (audit.metadata as { all?: boolean }).all === true)).toBe(true);
  });

  it("persists preferences and suppresses disabled optional in-app categories", async () => {
    const fixture = await createNotificationFixture();
    const defaults = await getNotificationPreferences(fixture.studentActor);
    expect(defaults).toEqual(defaultNotificationPreferences);

    const updated = await updateNotificationPreferences(fixture.studentActor, {
      registrationUpdates: true,
      attendanceUpdates: false,
      feedbackUpdates: false,
    });
    expect(updated).toEqual({
      registrationUpdates: true,
      attendanceUpdates: false,
      feedbackUpdates: false,
    });
    expect(await getNotificationPreferences(fixture.studentActor)).toEqual(updated);

    await runInTransaction(prisma, (tx) =>
      createNotifications(tx, [
        {
          collegeId: fixture.college.id,
          userId: fixture.student.id,
          type: "ATTENDANCE_UPDATE",
          title: "Suppressed attendance",
          body: "Should not be inserted.",
        },
        {
          collegeId: fixture.college.id,
          userId: fixture.student.id,
          type: "FEEDBACK_UPDATE",
          title: "Suppressed feedback",
          body: "Should not be inserted.",
        },
        {
          collegeId: fixture.college.id,
          userId: fixture.student.id,
          type: "REGISTRATION_UPDATE",
          title: "Allowed registration",
          body: "Should be inserted.",
        },
        {
          collegeId: fixture.college.id,
          userId: fixture.student.id,
          type: "SYSTEM",
          title: "Required system",
          body: "Always delivered in-app.",
        },
      ]),
    );

    const titles = await prisma.notification.findMany({
      where: { userId: fixture.student.id },
      select: { title: true },
    });
    const titleList = titles.map((row) => row.title);
    expect(titleList).toContain("Allowed registration");
    expect(titleList).toContain("Required system");
    expect(titleList).not.toContain("Suppressed attendance");
    expect(titleList).not.toContain("Suppressed feedback");

    const audits = await prisma.auditLog.findMany({
      where: { action: "NOTIFICATION_PREFERENCES_UPDATED", actorUserId: fixture.student.id },
    });
    expect(audits).toHaveLength(1);
  });

  it("rejects non-student notification queries", async () => {
    const fixture = await createNotificationFixture();
    const college = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const adminActor = await actorForUser(admin.id);

    await expect(getStudentNotifications(adminActor)).rejects.toBeInstanceOf(
      ActorNotAuthorizedError,
    );
    await expect(getNotificationPreferences(adminActor)).resolves.toEqual(
      defaultNotificationPreferences,
    );
    expect(fixture.student.id).toBeTruthy();
  });
});

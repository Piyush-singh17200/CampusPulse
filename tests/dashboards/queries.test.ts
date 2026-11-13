import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { ActorNotAuthorizedError, TenantIsolationError } from "@/server/errors";
import {
  assertClubDashboard,
  assertCollegeDashboard,
  assertCollegeScope,
  assertManagedClub,
  assertPlatformDashboard,
  assertStudentDashboard,
  managedClubIds,
} from "@/server/dashboards/access";
import {
  discoverEvents,
  getClubAnalytics,
  getClubAttendance,
  getClubDashboard,
  getClubEvent,
  getClubEvents,
  getClubRegistrations,
  getClubSettings,
  getClubWorkspace,
  getCollegeAnalytics,
  getCollegeApprovals,
  getCollegeAuditLogs,
  getCollegeClub,
  getCollegeClubs,
  getCollegeDashboard,
  getCollegeEvent,
  getCollegeEvents,
  getCollegeSettings,
  getCollegeUsers,
  getPlatformAnalytics,
  getPlatformAuditLogs,
  getPlatformCollege,
  getPlatformColleges,
  getPlatformDashboard,
  getPlatformSettings,
  getPlatformUsers,
  getStudentCalendar,
  getStudentContext,
  getStudentDashboard,
  getStudentEvent,
  getStudentNotifications,
  getStudentRegistrations,
  getStudentSavedEvents,
} from "@/server/dashboards/queries";
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
  unique,
} from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

async function createBaseFixture() {
  const college = await createCollege({ name: "Alpha College" });
  const otherCollege = await createCollege({ name: "Beta College" });
  const creator = await createUser({
    collegeId: college.id,
    role: "CLUB_ADMIN",
    name: "Alpha Creator",
  });
  const otherCreator = await createUser({
    collegeId: otherCollege.id,
    role: "CLUB_ADMIN",
    name: "Beta Creator",
  });
  const club = await createClub({
    collegeId: college.id,
    createdById: creator.id,
    name: "Alpha Club",
  });
  const otherClub = await createClub({
    collegeId: otherCollege.id,
    createdById: otherCreator.id,
    name: "Beta Club",
  });
  const category = await createCategory(college.id);
  const otherCategory = await createCategory(otherCollege.id);
  const clubAdmin = await createClubAdmin({ collegeId: college.id, clubId: club.id });
  const student = await createStudent(college.id);
  const otherStudent = await createStudent(otherCollege.id);
  const collegeAdmin = await createCollegeAdmin(college.id);
  const otherCollegeAdmin = await createCollegeAdmin(otherCollege.id);
  const superAdmin = await createSuperAdmin();

  return {
    college,
    otherCollege,
    creator,
    otherCreator,
    club,
    otherClub,
    category,
    otherCategory,
    clubAdmin,
    student,
    otherStudent,
    collegeAdmin,
    otherCollegeAdmin,
    superAdmin,
    studentActor: await actorForUser(student.user.id),
    otherStudentActor: await actorForUser(otherStudent.user.id),
    clubActor: await actorForUser(clubAdmin.id),
    collegeActor: await actorForUser(collegeAdmin.id),
    otherCollegeActor: await actorForUser(otherCollegeAdmin.id),
    superActor: await actorForUser(superAdmin.id),
  };
}

type BaseFixture = Awaited<ReturnType<typeof createBaseFixture>>;

async function addEvent(
  fixture: BaseFixture,
  input: {
    title: string;
    clubId?: string;
    collegeId?: string;
    createdById?: string;
    status?: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "REJECTED" | "CANCELLED" | "COMPLETED";
    startsAt?: Date;
    categoryId?: string;
  },
) {
  const collegeId = input.collegeId ?? fixture.college.id;
  const event = await createEvent({
    collegeId,
    clubId: input.clubId ?? fixture.club.id,
    createdById: input.createdById ?? fixture.creator.id,
    status: input.status ?? "PUBLISHED",
    startsAt: input.startsAt,
  });
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { title: input.title },
  });

  if (input.categoryId) {
    await prisma.eventCategory.create({
      data: {
        collegeId,
        eventId: event.id,
        categoryId: input.categoryId,
      },
    });
  }

  return updated;
}

function futureDate(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

describe("dashboard access helpers", () => {
  it("accepts the correct dashboard roles and rejects mismatches", async () => {
    const fixture = await createBaseFixture();

    expect(() => assertStudentDashboard(fixture.studentActor)).not.toThrow();
    expect(() => assertClubDashboard(fixture.clubActor)).not.toThrow();
    expect(assertCollegeDashboard(fixture.collegeActor)).toBe(fixture.college.id);
    expect(() => assertPlatformDashboard(fixture.superActor)).not.toThrow();

    expect(() => assertStudentDashboard(fixture.collegeActor)).toThrow(ActorNotAuthorizedError);
    expect(() => assertClubDashboard(fixture.studentActor)).toThrow(ActorNotAuthorizedError);
    expect(() => assertCollegeDashboard(fixture.clubActor)).toThrow(ActorNotAuthorizedError);
    expect(() => assertPlatformDashboard(fixture.collegeActor)).toThrow(ActorNotAuthorizedError);
  });

  it("requires an active president or officer membership for club dashboards", async () => {
    const fixture = await createBaseFixture();
    const member = await createClubAdmin({
      collegeId: fixture.college.id,
      clubId: fixture.club.id,
      membershipRole: "MEMBER",
    });
    const memberActor = await actorForUser(member.id);

    expect(() => assertClubDashboard(memberActor)).toThrow(ActorNotAuthorizedError);
    expect(managedClubIds(fixture.clubActor)).toEqual([fixture.club.id]);
    expect(managedClubIds(memberActor)).toEqual([]);
  });

  it("scopes college helpers and club manager assertions", async () => {
    const fixture = await createBaseFixture();

    expect(() => assertCollegeScope(fixture.collegeActor, fixture.college.id)).not.toThrow();
    expect(() => assertCollegeScope(fixture.superActor, fixture.otherCollege.id)).not.toThrow();
    expect(() => assertCollegeScope(fixture.collegeActor, fixture.otherCollege.id)).toThrow(
      ActorNotAuthorizedError,
    );
    expect(() => assertCollegeScope(fixture.clubActor, fixture.college.id)).toThrow(
      ActorNotAuthorizedError,
    );

    expect(() =>
      assertManagedClub(fixture.clubActor, fixture.club.id, fixture.college.id),
    ).not.toThrow();
    expect(() =>
      assertManagedClub(fixture.clubActor, fixture.otherClub.id, fixture.otherCollege.id),
    ).toThrow(ActorNotAuthorizedError);
  });
});

describe("student dashboard queries", () => {
  it("returns the student's own profile, college, and active interests", async () => {
    const fixture = await createBaseFixture();
    const active = await prisma.interest.create({
      data: { name: `Active ${unique("interest")}`, slug: unique("interest") },
    });
    await prisma.interest.create({
      data: {
        name: `Inactive ${unique("interest")}`,
        slug: unique("interest"),
        isActive: false,
      },
    });

    const context = await getStudentContext(fixture.studentActor);

    expect(context.profile?.id).toBe(fixture.student.profile.id);
    expect(context.college?.id).toBe(fixture.college.id);
    expect(context.allInterests.map((interest) => interest.id)).toContain(active.id);
    expect(context.allInterests.some((interest) => interest.name.startsWith("Inactive"))).toBe(
      false,
    );
  });

  it("discovers only published upcoming events in the student's college with filters and pagination", async () => {
    const fixture = await createBaseFixture();
    const robotics = await addEvent(fixture, {
      title: "Robotics Workshop",
      startsAt: futureDate(2),
      categoryId: fixture.category.id,
    });
    const music = await addEvent(fixture, {
      title: "Music Night",
      startsAt: futureDate(3),
      categoryId: fixture.category.id,
    });
    await addEvent(fixture, { title: "Hackathon", startsAt: futureDate(4) });
    await addEvent(fixture, { title: "Draft Robotics", status: "DRAFT", startsAt: futureDate(5) });
    await addEvent(fixture, {
      title: "Old Robotics",
      startsAt: futureDate(-2),
    });
    const inactiveClub = await createClub({
      collegeId: fixture.college.id,
      createdById: fixture.creator.id,
      status: "SUSPENDED",
    });
    await addEvent(fixture, {
      title: "Inactive Robotics",
      clubId: inactiveClub.id,
      startsAt: futureDate(6),
    });
    await addEvent(fixture, {
      title: "Other College Robotics",
      collegeId: fixture.otherCollege.id,
      clubId: fixture.otherClub.id,
      createdById: fixture.otherCreator.id,
      startsAt: futureDate(7),
      categoryId: fixture.otherCategory.id,
    });

    await prisma.savedEvent.create({
      data: {
        collegeId: fixture.college.id,
        studentProfileId: fixture.student.profile.id,
        eventId: robotics.id,
      },
    });
    await prisma.eventRegistration.create({
      data: {
        collegeId: fixture.college.id,
        eventId: music.id,
        studentProfileId: fixture.student.profile.id,
      },
    });

    const firstPage = await discoverEvents(fixture.studentActor, { pageSize: 2, page: 1 });
    expect(firstPage.total).toBe(3);
    expect(firstPage.events).toHaveLength(2);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.events.every((event) => event.collegeId === fixture.college.id)).toBe(true);
    expect(firstPage.savedEventIds.has(robotics.id)).toBe(true);
    expect(firstPage.registeredEventIds.has(music.id)).toBe(true);

    const secondPage = await discoverEvents(fixture.studentActor, { pageSize: 2, page: 2 });
    expect(secondPage.events).toHaveLength(1);

    const searched = await discoverEvents(fixture.studentActor, { q: "Robotics" });
    expect(searched.events.map((event) => event.id)).toEqual([robotics.id]);

    const categorised = await discoverEvents(fixture.studentActor, {
      category: fixture.category.slug,
    });
    expect(categorised.events.map((event) => event.id).sort()).toEqual(
      [robotics.id, music.id].sort(),
    );
    expect(categorised.categories.map((category) => category.id)).toEqual([fixture.category.id]);
  });

  it("returns a student event only inside the student's college and with registration state", async () => {
    const fixture = await createBaseFixture();
    const event = await addEvent(fixture, { title: "Visible Event", startsAt: futureDate(2) });
    const draft = await addEvent(fixture, {
      title: "Draft Event",
      status: "DRAFT",
      startsAt: futureDate(3),
    });
    const otherEvent = await addEvent(fixture, {
      title: "Other Event",
      collegeId: fixture.otherCollege.id,
      clubId: fixture.otherClub.id,
      createdById: fixture.otherCreator.id,
      startsAt: futureDate(4),
    });
    await prisma.eventRegistration.create({
      data: {
        collegeId: fixture.college.id,
        eventId: event.id,
        studentProfileId: fixture.student.profile.id,
      },
    });
    await prisma.savedEvent.create({
      data: {
        collegeId: fixture.college.id,
        studentProfileId: fixture.student.profile.id,
        eventId: event.id,
      },
    });

    const result = await getStudentEvent(fixture.studentActor, event.id);
    expect(result?.event.id).toBe(event.id);
    expect(result?.saved).toBe(true);
    expect(result?.registration?.status).toBe("CONFIRMED");
    expect(result?.activeCount).toBe(1);
    expect(result?.timezone).toBe(fixture.college.timezone);

    expect(await getStudentEvent(fixture.studentActor, draft.id)).toBeNull();
    expect(await getStudentEvent(fixture.studentActor, otherEvent.id)).toBeNull();
  });

  it("builds dashboard counts, registrations, saved events, calendar, and notifications from real rows", async () => {
    const fixture = await createBaseFixture();
    const first = await addEvent(fixture, { title: "First", startsAt: futureDate(2) });
    const second = await addEvent(fixture, { title: "Second", startsAt: futureDate(3) });
    const past = await addEvent(fixture, { title: "Past", startsAt: futureDate(-3) });
    await prisma.eventRegistration.createMany({
      data: [
        {
          collegeId: fixture.college.id,
          eventId: first.id,
          studentProfileId: fixture.student.profile.id,
          status: "CONFIRMED",
        },
        {
          collegeId: fixture.college.id,
          eventId: second.id,
          studentProfileId: fixture.student.profile.id,
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
        {
          collegeId: fixture.college.id,
          eventId: past.id,
          studentProfileId: fixture.student.profile.id,
          status: "ATTENDED",
          checkedInAt: new Date(),
        },
      ],
    });
    await prisma.savedEvent.create({
      data: {
        collegeId: fixture.college.id,
        studentProfileId: fixture.student.profile.id,
        eventId: first.id,
      },
    });
    await prisma.notification.create({
      data: {
        collegeId: fixture.college.id,
        userId: fixture.student.user.id,
        type: "SYSTEM",
        title: "Unread",
        body: "Body",
      },
    });
    await prisma.notification.create({
      data: {
        collegeId: fixture.college.id,
        userId: fixture.collegeAdmin.id,
        type: "SYSTEM",
        title: "Other user",
        body: "Body",
      },
    });

    const dashboard = await getStudentDashboard(fixture.studentActor);
    expect(dashboard.counts).toEqual({
      registered: 3,
      upcoming: 1,
      attended: 1,
      cancelled: 1,
      saved: 1,
    });
    expect(dashboard.unreadNotifications).toBe(1);
    expect(dashboard.upcoming.map((row) => row.event.id)).toEqual([first.id]);
    expect(dashboard.saved.map((event) => event.id)).toEqual([first.id]);

    const registrations = await getStudentRegistrations(fixture.studentActor);
    expect(registrations.counts).toEqual({ total: 3, confirmed: 1, attended: 1, cancelled: 1 });
    expect(registrations.upcoming.map((row) => row.event.id)).toEqual([first.id]);
    expect(registrations.past.map((row) => row.event.id).sort()).toEqual(
      [second.id, past.id].sort(),
    );

    const saved = await getStudentSavedEvents(fixture.studentActor);
    expect(saved.map((row) => row.event.id)).toEqual([first.id]);

    const calendar = await getStudentCalendar(fixture.studentActor);
    expect(calendar.timezone).toBe(fixture.college.timezone);
    expect(calendar.groups).toHaveLength(2);
    expect(
      calendar.groups.some((group) => group.items.some((item) => item.event.id === first.id)),
    ).toBe(true);

    const notifications = await getStudentNotifications(fixture.studentActor);
    expect(notifications.notifications).toHaveLength(1);
    expect(notifications.unread).toBe(1);
    expect(notifications.notifications[0]?.title).toBe("Unread");
  });
});

describe("club dashboard queries", () => {
  it("selects only managed clubs and rejects a cross-tenant club selection", async () => {
    const fixture = await createBaseFixture();

    const workspace = await getClubWorkspace(fixture.clubActor);
    expect(workspace.club?.id).toBe(fixture.club.id);
    expect(workspace.clubs.map((club) => club.id)).toEqual([fixture.club.id]);

    await expect(getClubWorkspace(fixture.clubActor, fixture.otherClub.id)).rejects.toBeInstanceOf(
      TenantIsolationError,
    );
  });

  it("scopes club events, counts, registrations, and analytics to the selected club", async () => {
    const fixture = await createBaseFixture();
    const published = await addEvent(fixture, {
      title: "Published",
      startsAt: futureDate(2),
    });
    await addEvent(fixture, { title: "Draft", status: "DRAFT", startsAt: futureDate(3) });
    await addEvent(fixture, {
      title: "Pending",
      status: "PENDING_APPROVAL",
      startsAt: futureDate(4),
    });
    await addEvent(fixture, { title: "Cancelled", status: "CANCELLED", startsAt: futureDate(5) });
    await addEvent(fixture, { title: "Completed", status: "COMPLETED", startsAt: futureDate(-5) });
    const otherEvent = await addEvent(fixture, {
      title: "Other Club Event",
      clubId: fixture.otherClub.id,
      collegeId: fixture.otherCollege.id,
      createdById: fixture.otherCreator.id,
      startsAt: futureDate(6),
    });
    await prisma.eventRegistration.create({
      data: {
        collegeId: fixture.college.id,
        eventId: published.id,
        studentProfileId: fixture.student.profile.id,
      },
    });

    const dashboard = await getClubDashboard(fixture.clubActor);
    expect(dashboard.counts).toEqual({
      total: 5,
      draft: 1,
      pending: 1,
      published: 1,
      cancelled: 1,
      completed: 1,
    });
    expect(dashboard.registrationCount).toBe(1);

    const drafts = await getClubEvents(fixture.clubActor, undefined, "DRAFT");
    expect(drafts.events.map((event) => event.id)).toHaveLength(1);
    expect(drafts.events[0]?.title).toBe("Draft");

    const event = await getClubEvent(fixture.clubActor, undefined, published.id);
    expect(event?.event.id).toBe(published.id);
    expect(event?.activeCount).toBe(1);
    expect(await getClubEvent(fixture.clubActor, undefined, otherEvent.id)).toBeNull();

    const registrations = await getClubRegistrations(fixture.clubActor, undefined, published.id);
    expect(registrations.selectedEvent?.id).toBe(published.id);
    expect(registrations.counts.total).toBe(1);
    expect(registrations.registrations[0]?.studentProfile.user.name).toBe(
      fixture.student.user.name,
    );

    const analytics = await getClubAnalytics(fixture.clubActor);
    expect(analytics.totalRegistrations).toBe(1);
    expect(analytics.eventBreakdown).toHaveLength(5);

    const settings = await getClubSettings(fixture.clubActor);
    expect(settings.club?.id).toBe(fixture.club.id);
  });

  it("returns attendance only for past published or completed events and rejects cross-club IDs", async () => {
    const fixture = await createBaseFixture();
    const past = await addEvent(fixture, {
      title: "Past Event",
      startsAt: futureDate(-2),
    });
    await addEvent(fixture, { title: "Upcoming", startsAt: futureDate(2) });
    const otherEvent = await addEvent(fixture, {
      title: "Other Event",
      clubId: fixture.otherClub.id,
      collegeId: fixture.otherCollege.id,
      createdById: fixture.otherCreator.id,
      startsAt: futureDate(-2),
    });
    await prisma.eventRegistration.create({
      data: {
        collegeId: fixture.college.id,
        eventId: past.id,
        studentProfileId: fixture.student.profile.id,
      },
    });

    const attendance = await getClubAttendance(fixture.clubActor, undefined, past.id);
    expect(attendance.selectedEvent?.id).toBe(past.id);
    expect(attendance.registrations).toHaveLength(1);

    await expect(
      getClubAttendance(fixture.clubActor, undefined, otherEvent.id),
    ).rejects.toBeInstanceOf(TenantIsolationError);
  });
});

describe("college dashboard queries", () => {
  it("scopes counts and approval queues to the administrator's college", async () => {
    const fixture = await createBaseFixture();
    await addEvent(fixture, { title: "Pending Event", status: "PENDING_APPROVAL" });
    await addEvent(fixture, { title: "Published Event", status: "PUBLISHED" });
    const pendingClub = await createClub({
      collegeId: fixture.college.id,
      createdById: fixture.creator.id,
      status: "PENDING",
    });
    const otherPendingClub = await createClub({
      collegeId: fixture.otherCollege.id,
      createdById: fixture.otherCreator.id,
      status: "PENDING",
    });
    await addEvent(fixture, {
      title: "Other Pending Event",
      status: "PENDING_APPROVAL",
      collegeId: fixture.otherCollege.id,
      clubId: fixture.otherClub.id,
      createdById: fixture.otherCreator.id,
    });

    const dashboard = await getCollegeDashboard(fixture.collegeActor);
    expect(dashboard.college.id).toBe(fixture.college.id);
    expect(dashboard.clubCounts.total).toBe(2);
    expect(dashboard.clubCounts.pending).toBe(1);
    expect(dashboard.eventCounts.total).toBe(2);
    expect(dashboard.eventCounts.pending).toBe(1);
    expect(dashboard.pendingClubs.map((club) => club.id)).toEqual([pendingClub.id]);
    expect(dashboard.pendingEvents.map((event) => event.title)).toEqual(["Pending Event"]);

    const approvals = await getCollegeApprovals(fixture.collegeActor);
    expect(approvals.pendingClubs.map((club) => club.id)).toEqual([pendingClub.id]);
    expect(approvals.pendingEvents.map((event) => event.title)).toEqual(["Pending Event"]);
    expect(approvals.pendingClubs.some((club) => club.id === otherPendingClub.id)).toBe(false);

    const published = await getCollegeEvents(fixture.collegeActor, "PUBLISHED");
    expect(published.events.map((event) => event.title)).toEqual(["Published Event"]);
  });

  it("scopes club, event, user, and audit queries, including pagination and filters", async () => {
    const fixture = await createBaseFixture();
    const event = await addEvent(fixture, { title: "Own Event", status: "PUBLISHED" });
    const otherEvent = await addEvent(fixture, {
      title: "Other Event",
      status: "PUBLISHED",
      collegeId: fixture.otherCollege.id,
      clubId: fixture.otherClub.id,
      createdById: fixture.otherCreator.id,
    });
    const ownClub = await createClub({
      collegeId: fixture.college.id,
      createdById: fixture.creator.id,
      status: "ACTIVE",
    });
    const otherClub = await createClub({
      collegeId: fixture.otherCollege.id,
      createdById: fixture.otherCreator.id,
      status: "ACTIVE",
    });

    const clubs = await getCollegeClubs(fixture.collegeActor, "ACTIVE");
    expect(clubs.clubs.map((club) => club.id)).toEqual([fixture.club.id, ownClub.id]);
    expect(await getCollegeClub(fixture.collegeActor, otherClub.id)).toBeNull();

    const users = await getCollegeUsers(fixture.collegeActor, { page: 2, pageSize: 2 });
    expect(users.total).toBe(4);
    expect(users.users).toHaveLength(2);
    expect(users.totalPages).toBe(2);
    expect(users.users.every((user) => user.id !== fixture.otherStudent.user.id)).toBe(true);

    const filtered = await getCollegeUsers(fixture.collegeActor, { q: "Alpha Creator" });
    expect(filtered.total).toBe(1);
    expect(filtered.users[0]?.name).toBe("Alpha Creator");

    await prisma.auditLog.createMany({
      data: Array.from({ length: 31 }, (_, index) => ({
        collegeId: fixture.college.id,
        actorUserId: fixture.collegeAdmin.id,
        action: "USER_STATUS_CHANGED" as const,
        entityType: "User",
        entityId: `user-${index}`,
        metadata: {},
      })),
    });
    await prisma.auditLog.create({
      data: {
        collegeId: fixture.otherCollege.id,
        actorUserId: fixture.otherCollegeAdmin.id,
        action: "USER_STATUS_CHANGED",
        entityType: "User",
        entityId: "other-user",
      },
    });

    const auditPage = await getCollegeAuditLogs(fixture.collegeActor, { page: 2 });
    expect(auditPage.total).toBe(31);
    expect(auditPage.logs).toHaveLength(1);
    expect(auditPage.totalPages).toBe(2);

    const filteredAudit = await getCollegeAuditLogs(fixture.collegeActor, {
      action: "USER_STATUS_CHANGED",
    });
    expect(filteredAudit.total).toBe(31);
    expect(
      (await getCollegeAuditLogs(fixture.collegeActor, { action: "EVENT_CREATED" })).total,
    ).toBe(0);

    expect(await getCollegeEvent(fixture.collegeActor, event.id)).not.toBeNull();
    expect(await getCollegeEvent(fixture.collegeActor, otherEvent.id)).toBeNull();

    const analytics = await getCollegeAnalytics(fixture.collegeActor);
    expect(analytics.eventStatusCounts.find((row) => row.status === "PUBLISHED")?.count).toBe(1);
    expect(analytics.college.id).toBe(fixture.college.id);

    const settings = await getCollegeSettings(fixture.collegeActor);
    expect(settings.college.id).toBe(fixture.college.id);
  });
});

describe("platform dashboard queries", () => {
  it("returns platform-wide counts and rejects non-platform actors", async () => {
    const fixture = await createBaseFixture();

    const dashboard = await getPlatformDashboard(fixture.superActor);
    expect(dashboard.collegeCounts.total).toBe(2);
    expect(dashboard.userCounts.total).toBe(8);
    expect(dashboard.clubCounts.total).toBe(2);
    expect(dashboard.eventCounts.total).toBe(0);

    await expect(getPlatformDashboard(fixture.collegeActor)).rejects.toBeInstanceOf(
      ActorNotAuthorizedError,
    );
  });

  it("filters and paginates colleges, users, and audit logs", async () => {
    const fixture = await createBaseFixture();
    await prisma.college.createMany({
      data: Array.from({ length: 19 }, (_, index) => ({
        name: `Extra College ${index}`,
        slug: unique(`extra-${index}`),
        timezone: "UTC",
      })),
    });
    await prisma.user.createMany({
      data: Array.from({ length: 31 }, (_, index) => ({
        collegeId: fixture.college.id,
        email: `extra-${index}-${unique("user")}@example.test`,
        name: `Extra Student ${index}`,
        role: "STUDENT" as const,
        status: "ACTIVE" as const,
      })),
    });
    await prisma.auditLog.createMany({
      data: [
        {
          collegeId: fixture.college.id,
          actorUserId: fixture.collegeAdmin.id,
          action: "USER_STATUS_CHANGED" as const,
          entityType: "User",
          entityId: "alpha-user",
        },
        {
          collegeId: fixture.otherCollege.id,
          actorUserId: fixture.otherCollegeAdmin.id,
          action: "COLLEGE_UPDATED" as const,
          entityType: "College",
          entityId: "beta-college",
        },
      ],
    });

    const colleges = await getPlatformColleges(fixture.superActor);
    expect(colleges.total).toBe(21);
    expect(colleges.colleges).toHaveLength(20);
    expect((await getPlatformColleges(fixture.superActor, { page: 2 })).colleges).toHaveLength(1);

    const alpha = await getPlatformColleges(fixture.superActor, { q: "Alpha" });
    expect(alpha.total).toBe(1);
    expect(alpha.colleges[0]?.id).toBe(fixture.college.id);

    const suspended = await getPlatformColleges(fixture.superActor, { status: "SUSPENDED" });
    expect(suspended.total).toBe(0);

    const users = await getPlatformUsers(fixture.superActor, {
      collegeId: fixture.college.id,
      page: 2,
    });
    expect(users.total).toBe(35);
    expect(users.users).toHaveLength(5);
    expect(users.users.every((user) => user.college?.id === fixture.college.id)).toBe(true);

    const filteredUsers = await getPlatformUsers(fixture.superActor, { role: "SUPER_ADMIN" });
    expect(filteredUsers.total).toBe(1);
    expect(filteredUsers.users[0]?.id).toBe(fixture.superAdmin.id);

    const audit = await getPlatformAuditLogs(fixture.superActor);
    expect(audit.total).toBe(2);
    expect(
      (await getPlatformAuditLogs(fixture.superActor, { action: "USER_STATUS_CHANGED" })).total,
    ).toBe(1);

    const college = await getPlatformCollege(fixture.superActor, fixture.otherCollege.id);
    expect(college?.id).toBe(fixture.otherCollege.id);
    expect(
      await getPlatformCollege(fixture.superActor, "00000000-0000-4000-8000-000000000000"),
    ).toBeNull();

    const analytics = await getPlatformAnalytics(fixture.superActor);
    expect(analytics.collegeStatusCounts.find((row) => row.status === "ACTIVE")?.count).toBe(21);
    expect(analytics.userRoleCounts.find((row) => row.role === "SUPER_ADMIN")?.count).toBe(1);

    const settings = await getPlatformSettings(fixture.superActor);
    expect(settings.collegeCount).toBe(21);
    expect(settings.userCount).toBe(39);
  });
});

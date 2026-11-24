import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/db/client";
import type { AuthenticatedActor } from "@/services/authorization";
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

const authState = vi.hoisted(() => ({
  user: null as unknown,
}));

vi.mock("@/server/auth/session", () => ({
  getCurrentUser: vi.fn(async () => authState.user),
}));

function setCurrentUser(actor: AuthenticatedActor | null) {
  authState.user = actor
    ? {
        ...actor,
        name: "Test User",
        email: "test@example.test",
        sessionId: "test-session",
        sessionExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }
    : null;
}

async function createExportFixture() {
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
  const { user: student, profile } = await createStudent(college.id, {
    name: "=SUM(1,1)",
  });
  const event = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  });
  await prisma.event.update({
    where: { id: event.id },
    data: {
      title: "Robotics; Demo, Day",
      summary: "A practical robotics session.",
    },
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
    collegeAdmin,
    superAdmin,
    student,
    profile,
    event,
    registration,
    managerActor: await actorForUser(manager.id),
    collegeAdminActor: await actorForUser(collegeAdmin.id),
    superAdminActor: await actorForUser(superAdmin.id),
    studentActor: await actorForUser(student.id),
  };
}

beforeEach(async () => {
  await resetDatabase();
  authState.user = null;
});

describe("Calendar route handlers", () => {
  it("returns an authenticated single-event ICS with safe download headers", async () => {
    const fixture = await createExportFixture();
    setCurrentUser(fixture.studentActor);
    const { GET } = await import("@/app/api/calendar/events/[eventId]/route");

    const response = await GET(
      new Request(`http://localhost/api/calendar/events/${fixture.event.id}`),
      { params: Promise.resolve({ eventId: fixture.event.id }) },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/calendar");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="/);
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("SUMMARY:Robotics\\; Demo\\, Day");
    expect(body).toContain("X-WR-TIMEZONE:Asia/Kolkata");
    expect(body).toContain("END:VCALENDAR");
  });

  it("returns 401 without a session and 404 for unpublished events", async () => {
    const fixture = await createExportFixture();
    const { GET } = await import("@/app/api/calendar/events/[eventId]/route");

    setCurrentUser(null);
    const unauthorized = await GET(
      new Request(`http://localhost/api/calendar/events/${fixture.event.id}`),
      { params: Promise.resolve({ eventId: fixture.event.id }) },
    );
    expect(unauthorized.status).toBe(401);

    setCurrentUser(fixture.studentActor);
    const draft = await createEvent({
      collegeId: fixture.college.id,
      clubId: fixture.club.id,
      createdById: fixture.creator.id,
      status: "DRAFT",
    });
    const missing = await GET(new Request(`http://localhost/api/calendar/events/${draft.id}`), {
      params: Promise.resolve({ eventId: draft.id }),
    });
    expect(missing.status).toBe(404);

    const malformed = await GET(new Request("http://localhost/api/calendar/events/not-a-uuid"), {
      params: Promise.resolve({ eventId: "not-a-uuid" }),
    });
    expect(malformed.status).toBe(404);
  });

  it("exports only the authenticated student's registered and saved events", async () => {
    const fixture = await createExportFixture();
    const secondEvent = await createEvent({
      collegeId: fixture.college.id,
      clubId: fixture.club.id,
      createdById: fixture.creator.id,
      status: "PUBLISHED",
      startsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    });
    const { user: secondStudent, profile: secondProfile } = await createStudent(fixture.college.id);
    await prisma.eventRegistration.create({
      data: {
        collegeId: fixture.college.id,
        eventId: secondEvent.id,
        studentProfileId: secondProfile.id,
        status: "CONFIRMED",
      },
    });
    await prisma.savedEvent.create({
      data: {
        collegeId: fixture.college.id,
        eventId: secondEvent.id,
        studentProfileId: fixture.profile.id,
      },
    });

    setCurrentUser(fixture.studentActor);
    const registered = await import("@/app/api/calendar/registered/route");
    const registeredResponse = await registered.GET();
    const registeredBody = await registeredResponse.text();
    expect(registeredResponse.status).toBe(200);
    expect(registeredBody).toContain("SUMMARY:Robotics\\; Demo\\, Day");
    expect(registeredBody).not.toContain(secondEvent.title);
    expect(registeredBody.match(/BEGIN:VEVENT/g)).toHaveLength(1);

    const saved = await import("@/app/api/calendar/saved/route");
    const savedResponse = await saved.GET();
    const savedBody = await savedResponse.text();
    expect(savedResponse.status).toBe(200);
    expect(savedBody).toContain(secondEvent.title);
    expect(savedBody).not.toContain("SUMMARY:Robotics\\; Demo\\, Day");
    expect(secondStudent.id).toBeTruthy();
  });

  it("rejects calendar exports for non-student roles", async () => {
    const fixture = await createExportFixture();
    setCurrentUser(fixture.managerActor);
    const { GET } = await import("@/app/api/calendar/registered/route");
    const response = await GET();

    expect(response.status).toBe(403);
  });
});

describe("CSV export route handlers", () => {
  it("exports authorized club attendance with injection-safe cells", async () => {
    const fixture = await createExportFixture();
    setCurrentUser(fixture.managerActor);
    const { GET } = await import("@/app/api/exports/club/attendance/route");

    const response = await GET(
      new Request(
        `http://localhost/api/exports/club/attendance?clubId=${fixture.club.id}&eventId=${fixture.event.id}`,
      ),
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    const body = new TextDecoder().decode(bytes);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(".csv");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(body.startsWith("Student,Roll number,Department")).toBe(true);
    expect(body).toContain("'=SUM(1,1)");
    expect(body).toContain("CONFIRMED");
  });

  it("rejects missing attendance parameters and unauthorized callers", async () => {
    const fixture = await createExportFixture();
    const { GET } = await import("@/app/api/exports/club/attendance/route");

    setCurrentUser(fixture.managerActor);
    const missing = await GET(
      new Request(`http://localhost/api/exports/club/attendance?clubId=${fixture.club.id}`),
    );
    expect(missing.status).toBe(400);

    const malformed = await GET(
      new Request(
        `http://localhost/api/exports/club/attendance?clubId=${fixture.club.id}&eventId=not-a-uuid`,
      ),
    );
    expect(malformed.status).toBe(404);

    setCurrentUser(fixture.studentActor);
    const unauthorized = await GET(
      new Request(
        `http://localhost/api/exports/club/attendance?clubId=${fixture.club.id}&eventId=${fixture.event.id}`,
      ),
    );
    expect(unauthorized.status).toBe(403);
  });

  it("exports club, college, and platform analytics only to their authorized roles", async () => {
    const fixture = await createExportFixture();
    const clubRoute = await import("@/app/api/exports/club/analytics/route");
    const collegeRoute = await import("@/app/api/exports/college/analytics/route");
    const platformRoute = await import("@/app/api/exports/platform/analytics/route");

    setCurrentUser(fixture.managerActor);
    const clubResponse = await clubRoute.GET(
      new Request(
        `http://localhost/api/exports/club/analytics?clubId=${fixture.club.id}&from=2020-01-01&to=2030-01-01`,
      ),
    );
    expect(clubResponse.status).toBe(200);
    expect(await clubResponse.text()).toContain("Attendance rate (%)");

    setCurrentUser(fixture.studentActor);
    const deniedCollege = await collegeRoute.GET(
      new Request("http://localhost/api/exports/college/analytics"),
    );
    expect(deniedCollege.status).toBe(403);

    setCurrentUser(fixture.collegeAdminActor);
    const collegeResponse = await collegeRoute.GET(
      new Request("http://localhost/api/exports/college/analytics?from=2020-01-01&to=2030-01-01"),
    );
    expect(collegeResponse.status).toBe(200);
    expect(await collegeResponse.text()).toContain("Robotics Club");

    setCurrentUser(fixture.collegeAdminActor);
    const deniedPlatform = await platformRoute.GET(
      new Request("http://localhost/api/exports/platform/analytics"),
    );
    expect(deniedPlatform.status).toBe(403);

    setCurrentUser(fixture.superAdminActor);
    const platformResponse = await platformRoute.GET(
      new Request("http://localhost/api/exports/platform/analytics"),
    );
    expect(platformResponse.status).toBe(200);
    expect(await platformResponse.text()).toContain("Active colleges");
  });

  it("does not leak another college's analytics through export filters", async () => {
    const fixture = await createExportFixture();
    const otherCollege = await createCollege({ name: "Other College" });
    const otherCreator = await createUser({
      collegeId: otherCollege.id,
      role: "CLUB_ADMIN",
    });
    const otherClub = await createClub({
      collegeId: otherCollege.id,
      createdById: otherCreator.id,
      name: "Other Club",
    });
    const otherManager = await createClubAdmin({
      collegeId: otherCollege.id,
      clubId: otherClub.id,
    });
    const otherManagerActor = await actorForUser(otherManager.id);

    setCurrentUser(otherManagerActor);
    const { GET } = await import("@/app/api/exports/club/analytics/route");
    const response = await GET(
      new Request(`http://localhost/api/exports/club/analytics?clubId=${fixture.club.id}`),
    );

    expect(response.status).toBe(404);
  });
});

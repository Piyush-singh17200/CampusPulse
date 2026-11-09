import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { DomainError, InvalidTransitionError, TenantIsolationError } from "@/server/errors";
import { cancelRegistration, registerForEvent } from "@/services/registrations";
import { resetDatabase } from "@tests/helpers/db";
import {
  actorForUser,
  createClub,
  createCollege,
  createEvent,
  createStudent,
  createUser,
} from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

async function createRegistrationFixture(
  input: {
    status?: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "REJECTED" | "CANCELLED" | "COMPLETED";
    capacity?: number | null;
    startsAt?: Date;
    registrationOpensAt?: Date | null;
    registrationDeadline?: Date | null;
  } = {},
) {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const event = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: input.status ?? "PUBLISHED",
    capacity: input.capacity,
    startsAt: input.startsAt,
    registrationOpensAt: input.registrationOpensAt,
    registrationDeadline: input.registrationDeadline,
  });
  const { user: student, profile } = await createStudent(college.id);

  return {
    college,
    creator,
    club,
    event,
    student,
    profile,
    studentActor: await actorForUser(student.id),
  };
}

async function expectDomainCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("registration service", () => {
  it("registers a student successfully and writes an audit record", async () => {
    const { event, student, studentActor } = await createRegistrationFixture();

    const registration = await registerForEvent(studentActor, {
      eventId: event.id,
    });

    expect(registration.status).toBe("CONFIRMED");
    expect(registration.eventId).toBe(event.id);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: "EventRegistration",
        entityId: registration.id,
        action: "REGISTRATION_STATUS_CHANGED",
      },
    });
    expect(audit?.actorUserId).toBe(student.id);
    expect(audit?.collegeId).toBe(event.collegeId);
  });

  it("rejects a duplicate registration", async () => {
    const { event, studentActor } = await createRegistrationFixture();

    await registerForEvent(studentActor, { eventId: event.id });

    await expectDomainCode(
      registerForEvent(studentActor, { eventId: event.id }),
      "ALREADY_REGISTERED",
    );

    const count = await prisma.eventRegistration.count({ where: { eventId: event.id } });
    expect(count).toBe(1);
  });

  it("rejects registration for a cancelled event", async () => {
    const { event, studentActor } = await createRegistrationFixture({ status: "CANCELLED" });

    await expectDomainCode(registerForEvent(studentActor, { eventId: event.id }), "EVENT_NOT_OPEN");
  });

  it("rejects registration for a full event", async () => {
    const { event, studentActor } = await createRegistrationFixture({ capacity: 1 });
    const otherCollegeStudent = await createStudent(event.collegeId);
    const otherStudentActor = await actorForUser(otherCollegeStudent.user.id);

    await registerForEvent(studentActor, { eventId: event.id });

    await expectDomainCode(
      registerForEvent(otherStudentActor, { eventId: event.id }),
      "EVENT_FULL",
    );
  });

  it("rejects registration after the deadline", async () => {
    const { event, studentActor } = await createRegistrationFixture({
      registrationDeadline: new Date(Date.now() - 60_000),
    });

    await expectDomainCode(
      registerForEvent(studentActor, { eventId: event.id }),
      "REGISTRATION_CLOSED",
    );
  });

  it("rejects registration before it opens", async () => {
    const { event, studentActor } = await createRegistrationFixture({
      registrationOpensAt: new Date(Date.now() + 60_000),
    });

    await expectDomainCode(
      registerForEvent(studentActor, { eventId: event.id }),
      "REGISTRATION_NOT_OPEN",
    );
  });

  it("rejects an invalid registration status transition", async () => {
    const { event, studentActor } = await createRegistrationFixture();
    await registerForEvent(studentActor, { eventId: event.id });
    await cancelRegistration(studentActor, { eventId: event.id });

    await expect(cancelRegistration(studentActor, { eventId: event.id })).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
  });

  it("cancels a registration safely", async () => {
    const { event, studentActor } = await createRegistrationFixture();
    const registration = await registerForEvent(studentActor, {
      eventId: event.id,
    });

    const cancelled = await cancelRegistration(studentActor, {
      eventId: event.id,
    });

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: "EventRegistration",
        entityId: registration.id,
        action: "REGISTRATION_STATUS_CHANGED",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.metadata).toMatchObject({ to: "CANCELLED" });
  });

  it("rejects a cross-college registration", async () => {
    const { event } = await createRegistrationFixture();
    const otherCollege = await createCollege();
    const { user: otherStudent } = await createStudent(otherCollege.id);
    const otherStudentActor = await actorForUser(otherStudent.id);

    await expect(registerForEvent(otherStudentActor, { eventId: event.id })).rejects.toBeInstanceOf(
      TenantIsolationError,
    );
  });

  it("rejects a non-student actor", async () => {
    const { event, college } = await createRegistrationFixture();
    const admin = await createUser({ collegeId: college.id, role: "COLLEGE_ADMIN" });
    const adminActor = await actorForUser(admin.id);

    await expectDomainCode(
      registerForEvent(adminActor, { eventId: event.id }),
      "ACTOR_NOT_AUTHORIZED",
    );
  });

  it("never exceeds capacity under concurrent registration", async () => {
    const { event, college } = await createRegistrationFixture({ capacity: 1 });
    const students = await Promise.all([
      createStudent(college.id),
      createStudent(college.id),
      createStudent(college.id),
      createStudent(college.id),
    ]);

    const results = await Promise.allSettled(
      students.map(async ({ user }) =>
        registerForEvent(await actorForUser(user.id), { eventId: event.id }),
      ),
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(3);
    for (const result of rejected) {
      expect((result as PromiseRejectedResult).reason).toMatchObject({ code: "EVENT_FULL" });
    }

    const confirmed = await prisma.eventRegistration.count({
      where: { eventId: event.id, status: "CONFIRMED" },
    });
    expect(confirmed).toBe(1);
  });

  it("prevents duplicate registrations under concurrency", async () => {
    const { event, studentActor } = await createRegistrationFixture();

    const results = await Promise.allSettled([
      registerForEvent(studentActor, { eventId: event.id }),
      registerForEvent(studentActor, { eventId: event.id }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const count = await prisma.eventRegistration.count({ where: { eventId: event.id } });
    expect(count).toBe(1);
  });

  it("reports a domain error for a missing student profile", async () => {
    const { event, college } = await createRegistrationFixture();
    const userWithoutProfile = await createUser({
      collegeId: college.id,
      role: "STUDENT",
    });
    const actorWithoutProfile = await actorForUser(userWithoutProfile.id);

    await expectDomainCode(
      registerForEvent(actorWithoutProfile, { eventId: event.id }),
      "ACTOR_NOT_AUTHORIZED",
    );
  });

  it("uses a domain error type rather than leaking Prisma details", async () => {
    const { event, studentActor } = await createRegistrationFixture({ status: "COMPLETED" });

    await expect(registerForEvent(studentActor, { eventId: event.id })).rejects.toBeInstanceOf(
      DomainError,
    );
  });
});

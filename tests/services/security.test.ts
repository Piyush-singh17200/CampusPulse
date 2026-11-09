import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { writeAuditLog, redactAuditMetadata } from "@/server/db/audit";
import { ActorNotAuthorizedError, InvalidInputError } from "@/server/errors";
import { changeUserRole } from "@/services/users";
import { decideClub } from "@/services/clubs";
import { transitionEvent } from "@/services/events";
import { createTenantContext } from "@/server/db/tenant";
import { registerStudent } from "@/server/auth/registration";
import { resetDatabase } from "@tests/helpers/db";
import { getSessionFromCookie, sessionCookie, signInWithPassword } from "@tests/helpers/auth";
import {
  actorForUser,
  createClub,
  createClubAdmin,
  createCollege,
  createCollegeAdmin,
  createEvent,
  createUser,
} from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

describe("security boundaries", () => {
  it("fails closed for missing and invalid tenant context", () => {
    expect(() => createTenantContext({})).toThrow(InvalidInputError);
    expect(() => createTenantContext({ collegeId: "invalid" })).toThrow(InvalidInputError);
  });

  it("rejects a cross-tenant event transition", async () => {
    const college = await createCollege();
    const otherCollege = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: creator.id });
    const event = await createEvent({
      collegeId: college.id,
      clubId: club.id,
      createdById: creator.id,
      status: "DRAFT",
    });
    const otherAdmin = await createCollegeAdmin(otherCollege.id);
    const otherAdminActor = await actorForUser(otherAdmin.id);

    await expect(
      transitionEvent(otherAdminActor, {
        eventId: event.id,
        to: "PENDING_APPROVAL",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("does not allow a student to approve an event", async () => {
    const college = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: creator.id });
    const event = await createEvent({
      collegeId: college.id,
      clubId: club.id,
      createdById: creator.id,
      status: "PENDING_APPROVAL",
    });
    const student = await createUser({ collegeId: college.id, role: "STUDENT" });
    const studentActor = await actorForUser(student.id);

    await expect(
      transitionEvent(studentActor, {
        eventId: event.id,
        to: "PUBLISHED",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("does not allow a club administrator to approve a club", async () => {
    const college = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({
      collegeId: college.id,
      createdById: creator.id,
      status: "PENDING",
    });
    const clubAdmin = await createClubAdmin({ collegeId: college.id, clubId: club.id });
    const clubAdminActor = await actorForUser(clubAdmin.id);

    await expect(
      decideClub(clubAdminActor, {
        clubId: club.id,
        decision: "APPROVE",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("prevents college administrators from granting SUPER_ADMIN", async () => {
    const college = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const adminActor = await actorForUser(admin.id);
    const target = await createUser({ collegeId: college.id, role: "STUDENT" });

    await expect(
      changeUserRole(adminActor, {
        targetUserId: target.id,
        role: "SUPER_ADMIN",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("prevents college administrators from changing users in another college", async () => {
    const college = await createCollege();
    const otherCollege = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const adminActor = await actorForUser(admin.id);
    const target = await createUser({ collegeId: otherCollege.id, role: "STUDENT" });

    await expect(
      changeUserRole(adminActor, {
        targetUserId: target.id,
        role: "CLUB_ADMIN",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("prevents self role changes", async () => {
    const college = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const adminActor = await actorForUser(admin.id);

    await expect(
      changeUserRole(adminActor, {
        targetUserId: admin.id,
        role: "STUDENT",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("rejects cross-tenant club decisions", async () => {
    const college = await createCollege();
    const otherCollege = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({
      collegeId: college.id,
      createdById: creator.id,
      status: "PENDING",
    });
    const otherAdmin = await createCollegeAdmin(otherCollege.id);
    const otherAdminActor = await actorForUser(otherAdmin.id);

    await expect(
      decideClub(otherAdminActor, {
        clubId: club.id,
        decision: "APPROVE",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("approves a club and writes an audit record", async () => {
    const college = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({
      collegeId: college.id,
      createdById: creator.id,
      status: "PENDING",
    });
    const admin = await createCollegeAdmin(college.id);
    const adminActor = await actorForUser(admin.id);

    const approved = await decideClub(adminActor, {
      clubId: club.id,
      decision: "APPROVE",
    });

    expect(approved.status).toBe("ACTIVE");
    expect(approved.approvedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Club", entityId: club.id, action: "CLUB_APPROVED" },
    });
    expect(audit?.actorUserId).toBe(admin.id);
    expect(audit?.collegeId).toBe(college.id);
  });

  it("changes a user role within the college and writes an audit record", async () => {
    const college = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const adminActor = await actorForUser(admin.id);
    const target = await createUser({ collegeId: college.id, role: "STUDENT" });

    const updated = await changeUserRole(adminActor, {
      targetUserId: target.id,
      role: "CLUB_ADMIN",
    });

    expect(updated.role).toBe("CLUB_ADMIN");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "User", entityId: target.id, action: "USER_ROLE_CHANGED" },
    });
    expect(audit?.actorUserId).toBe(admin.id);
    expect(audit?.metadata).toMatchObject({ from: "STUDENT", to: "CLUB_ADMIN" });
  });

  it("revokes every session when a role changes", async () => {
    const college = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const adminActor = await actorForUser(admin.id);
    const registered = await registerStudent({
      name: "Role Change Student",
      email: "role-change@example.test",
      password: "CampusPulse!2026",
      collegeId: college.id,
    });
    const cookie = sessionCookie(
      await signInWithPassword(registered.user.email, "CampusPulse!2026"),
    );

    expect(await prisma.session.count({ where: { userId: registered.user.id } })).toBe(1);
    expect(await getSessionFromCookie(cookie)).not.toBeNull();

    await changeUserRole(adminActor, {
      targetUserId: registered.user.id,
      role: "CLUB_ADMIN",
    });

    expect(await prisma.session.count({ where: { userId: registered.user.id } })).toBe(0);
    expect(await getSessionFromCookie(cookie)).toBeNull();

    const authAudit = await prisma.authAuditEvent.findFirst({
      where: { userId: registered.user.id, event: "SESSION_REVOKED" },
    });
    expect(authAudit?.metadata).toMatchObject({
      reason: "role_changed",
      fromRole: "STUDENT",
      toRole: "CLUB_ADMIN",
      revokedCount: 1,
    });
  });

  it("redacts secrets from audit metadata", async () => {
    const redacted = redactAuditMetadata({
      password: "super-secret",
      nested: { authorization: "Bearer abc", safe: "visible" },
      note: "ok",
    });

    expect(redacted).toMatchObject({
      password: "[redacted]",
      nested: { authorization: "[redacted]", safe: "visible" },
      note: "ok",
    });

    const college = await createCollege();
    const actor = await createUser({ collegeId: college.id, role: "COLLEGE_ADMIN" });

    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        collegeId: college.id,
        actorUserId: actor.id,
        action: "COLLEGE_UPDATED",
        entityType: "College",
        entityId: college.id,
        metadata: {
          password: "do-not-store",
          token: "do-not-store",
          safeField: "kept",
        },
      });
    });

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: college.id, action: "COLLEGE_UPDATED" },
    });
    expect(audit?.metadata).toMatchObject({
      password: "[redacted]",
      token: "[redacted]",
      safeField: "kept",
    });
    expect(JSON.stringify(audit?.metadata)).not.toContain("do-not-store");
  });

  it("rolls back audit writes with the enclosing transaction", async () => {
    const college = await createCollege();
    const actor = await createUser({ collegeId: college.id, role: "COLLEGE_ADMIN" });

    await expect(
      prisma.$transaction(async (tx) => {
        await writeAuditLog(tx, {
          collegeId: college.id,
          actorUserId: actor.id,
          action: "COLLEGE_UPDATED",
          entityType: "College",
          entityId: college.id,
          metadata: { reason: "rollback test" },
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const count = await prisma.auditLog.count({
      where: { entityId: college.id, action: "COLLEGE_UPDATED" },
    });
    expect(count).toBe(0);
  });
});

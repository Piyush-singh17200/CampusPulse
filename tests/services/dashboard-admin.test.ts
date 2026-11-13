import { beforeEach, describe, expect, it } from "vitest";

import { loadActorContext } from "@/server/auth/actor";
import { prisma } from "@/server/db/client";
import { ActorNotAuthorizedError, InvalidInputError } from "@/server/errors";
import { changeCollegeStatus, updateCollegeSettings } from "@/services/colleges";
import { updateClubProfile } from "@/services/clubs";
import { changeUserStatus } from "@/services/user-status";
import { resetDatabase } from "@tests/helpers/db";
import {
  actorForUser,
  createClub,
  createClubAdmin,
  createCollege,
  createCollegeAdmin,
  createStudent,
  createSuperAdmin,
  createUser,
  unique,
} from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

async function createSession(userId: string) {
  return prisma.session.create({
    data: {
      userId,
      token: unique("session"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
}

describe("club profile service", () => {
  it("lets an active club manager update the club profile and records an audit entry", async () => {
    const college = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: creator.id });
    const manager = await createClubAdmin({ collegeId: college.id, clubId: club.id });
    const actor = await actorForUser(manager.id);

    const updated = await updateClubProfile(actor, {
      clubId: club.id,
      name: "Renamed Club",
      description: "A better description.",
    });

    expect(updated.name).toBe("Renamed Club");
    expect(updated.description).toBe("A better description.");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "CLUB_UPDATED", entityId: club.id },
    });
    expect(audit?.actorUserId).toBe(manager.id);
    expect(audit?.metadata).toMatchObject({
      changedFields: expect.arrayContaining(["name", "description"]),
    });
  });

  it("clears a blank description", async () => {
    const college = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: creator.id });
    const manager = await createClubAdmin({ collegeId: college.id, clubId: club.id });
    const actor = await actorForUser(manager.id);

    const updated = await updateClubProfile(actor, {
      clubId: club.id,
      name: club.name,
      description: "   ",
    });

    expect(updated.description).toBeNull();
  });

  it("rejects non-managers, cross-club managers, inactive clubs, and invalid names", async () => {
    const college = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: creator.id });
    const manager = await createClubAdmin({ collegeId: college.id, clubId: club.id });
    const managerActor = await actorForUser(manager.id);
    const collegeAdmin = await createCollegeAdmin(college.id);
    const collegeActor = await actorForUser(collegeAdmin.id);
    const otherCreator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const otherClub = await createClub({ collegeId: college.id, createdById: otherCreator.id });
    const otherManager = await createClubAdmin({
      collegeId: college.id,
      clubId: otherClub.id,
    });
    const otherManagerActor = await actorForUser(otherManager.id);
    const inactiveClub = await createClub({
      collegeId: college.id,
      createdById: creator.id,
      status: "SUSPENDED",
    });
    const inactiveManager = await createClubAdmin({
      collegeId: college.id,
      clubId: inactiveClub.id,
    });
    const inactiveManagerActor = await actorForUser(inactiveManager.id);

    await expect(
      updateClubProfile(collegeActor, {
        clubId: club.id,
        name: "College Admin Edit",
        description: null,
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    await expect(
      updateClubProfile(otherManagerActor, {
        clubId: club.id,
        name: "Cross Club Edit",
        description: null,
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    await expect(
      updateClubProfile(inactiveManagerActor, {
        clubId: inactiveClub.id,
        name: "Inactive Edit",
        description: null,
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    await expect(
      updateClubProfile(managerActor, {
        clubId: club.id,
        name: "x",
        description: null,
      }),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });
});

describe("college settings service", () => {
  it("updates the administrator's own college and records changed fields", async () => {
    const college = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const actor = await actorForUser(admin.id);

    const updated = await updateCollegeSettings(actor, {
      name: "Updated College",
      shortName: "UC",
      timezone: "America/New_York",
    });

    expect(updated).toMatchObject({
      id: college.id,
      name: "Updated College",
      shortName: "UC",
      timezone: "America/New_York",
      status: "ACTIVE",
    });

    const audit = await prisma.auditLog.findFirst({
      where: { action: "COLLEGE_UPDATED", entityId: college.id },
    });
    expect(audit?.actorUserId).toBe(admin.id);
    expect(audit?.metadata).toMatchObject({
      changedFields: expect.arrayContaining(["name", "shortName", "timezone"]),
    });
  });

  it("clears a blank short name", async () => {
    const college = await createCollege({ shortName: "OLD" });
    const admin = await createCollegeAdmin(college.id);
    const actor = await actorForUser(admin.id);

    const updated = await updateCollegeSettings(actor, {
      name: college.name,
      shortName: "   ",
      timezone: college.timezone,
    });

    expect(updated.shortName).toBeNull();
  });

  it("rejects invalid timezones without changing the college", async () => {
    const college = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const actor = await actorForUser(admin.id);

    await expect(
      updateCollegeSettings(actor, {
        name: "Broken College",
        shortName: null,
        timezone: "Not/A-Timezone",
      }),
    ).rejects.toBeInstanceOf(InvalidInputError);

    const unchanged = await prisma.college.findUniqueOrThrow({ where: { id: college.id } });
    expect(unchanged.name).toBe(college.name);
  });

  it("rejects students, club administrators, and platform administrators", async () => {
    const college = await createCollege();
    const student = await createStudent(college.id);
    const studentActor = await actorForUser(student.user.id);
    const clubAdmin = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const clubActor = await actorForUser(clubAdmin.id);
    const superAdmin = await createSuperAdmin();
    const superActor = await actorForUser(superAdmin.id);
    const input = { name: "Nope", shortName: null, timezone: "Asia/Kolkata" };

    await expect(updateCollegeSettings(studentActor, input)).rejects.toBeInstanceOf(
      ActorNotAuthorizedError,
    );
    await expect(updateCollegeSettings(clubActor, input)).rejects.toBeInstanceOf(
      ActorNotAuthorizedError,
    );
    await expect(updateCollegeSettings(superActor, input)).rejects.toBeInstanceOf(
      ActorNotAuthorizedError,
    );
  });
});

describe("college lifecycle service", () => {
  it("suspends a college, revokes its sessions, and invalidates actor contexts", async () => {
    const college = await createCollege();
    const student = await createStudent(college.id);
    const admin = await createCollegeAdmin(college.id);
    const otherCollege = await createCollege();
    const otherStudent = await createStudent(otherCollege.id);
    const superAdmin = await createSuperAdmin();
    const actor = await actorForUser(superAdmin.id);

    await createSession(student.user.id);
    await createSession(student.user.id);
    await createSession(admin.id);
    await createSession(otherStudent.user.id);

    const updated = await changeCollegeStatus(actor, {
      collegeId: college.id,
      status: "SUSPENDED",
    });

    expect(updated.status).toBe("SUSPENDED");
    expect(await prisma.session.count({ where: { user: { collegeId: college.id } } })).toBe(0);
    expect(await prisma.session.count({ where: { user: { collegeId: otherCollege.id } } })).toBe(1);
    expect(await loadActorContext(student.user.id)).toBeNull();
    expect(await loadActorContext(admin.id)).toBeNull();
    expect(await loadActorContext(otherStudent.user.id)).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "COLLEGE_UPDATED", entityId: college.id },
    });
    expect(audit?.metadata).toMatchObject({
      from: "ACTIVE",
      to: "SUSPENDED",
      revokedCount: 3,
    });

    const authAudit = await prisma.authAuditEvent.findFirst({
      where: { collegeId: college.id, event: "SESSION_REVOKED" },
    });
    expect(authAudit?.metadata).toMatchObject({
      reason: "college_status_changed",
      revokedCount: 3,
    });
  });

  it("reactivates a college without restoring revoked sessions", async () => {
    const college = await createCollege({ status: "SUSPENDED" });
    const student = await createStudent(college.id);
    const superAdmin = await createSuperAdmin();
    const actor = await actorForUser(superAdmin.id);

    const updated = await changeCollegeStatus(actor, {
      collegeId: college.id,
      status: "ACTIVE",
    });

    expect(updated.status).toBe("ACTIVE");
    expect(await prisma.session.count({ where: { userId: student.user.id } })).toBe(0);
    expect(await loadActorContext(student.user.id)).not.toBeNull();
  });

  it("returns an unchanged status without writing another audit entry", async () => {
    const college = await createCollege({ status: "SUSPENDED" });
    const superAdmin = await createSuperAdmin();
    const actor = await actorForUser(superAdmin.id);

    const result = await changeCollegeStatus(actor, {
      collegeId: college.id,
      status: "SUSPENDED",
    });

    expect(result).toMatchObject({ id: college.id, status: "SUSPENDED" });
    expect(
      await prisma.auditLog.count({
        where: { action: "COLLEGE_UPDATED", entityId: college.id },
      }),
    ).toBe(0);
  });

  it("rejects non-platform actors, missing colleges, and invalid input", async () => {
    const college = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const adminActor = await actorForUser(admin.id);
    const superAdmin = await createSuperAdmin();
    const superActor = await actorForUser(superAdmin.id);

    await expect(
      changeCollegeStatus(adminActor, { collegeId: college.id, status: "SUSPENDED" }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    await expect(
      changeCollegeStatus(superActor, {
        collegeId: "00000000-0000-4000-8000-000000000000",
        status: "SUSPENDED",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      changeCollegeStatus(superActor, { collegeId: college.id, status: "DELETED" }),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });
});

describe("user status service", () => {
  it("lets a college administrator suspend a user in the same college and revoke sessions", async () => {
    const college = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const target = await createStudent(college.id);
    const actor = await actorForUser(admin.id);
    await createSession(target.user.id);

    const updated = await changeUserStatus(actor, {
      targetUserId: target.user.id,
      status: "SUSPENDED",
    });

    expect(updated.status).toBe("SUSPENDED");
    expect(await prisma.session.count({ where: { userId: target.user.id } })).toBe(0);
    expect(await loadActorContext(target.user.id)).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "USER_STATUS_CHANGED", entityId: target.user.id },
    });
    expect(audit?.metadata).toMatchObject({
      from: "ACTIVE",
      to: "SUSPENDED",
      revokedCount: 1,
    });
    expect(
      await prisma.authAuditEvent.count({
        where: { userId: target.user.id, event: "SESSION_REVOKED" },
      }),
    ).toBe(1);
  });

  it("lets a platform administrator change any non-self account", async () => {
    const college = await createCollege();
    const target = await createCollegeAdmin(college.id);
    const superAdmin = await createSuperAdmin();
    const actor = await actorForUser(superAdmin.id);

    const updated = await changeUserStatus(actor, {
      targetUserId: target.id,
      status: "DISABLED",
    });

    expect(updated.status).toBe("DISABLED");
    expect(await loadActorContext(target.id)).toBeNull();
  });

  it("prevents cross-college, platform-admin, and self modifications", async () => {
    const college = await createCollege();
    const otherCollege = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const otherStudent = await createStudent(otherCollege.id);
    const platformAdmin = await createSuperAdmin();
    const actor = await actorForUser(admin.id);

    await expect(
      changeUserStatus(actor, {
        targetUserId: otherStudent.user.id,
        status: "SUSPENDED",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    await expect(
      changeUserStatus(actor, {
        targetUserId: platformAdmin.id,
        status: "SUSPENDED",
      }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    await expect(
      changeUserStatus(actor, { targetUserId: admin.id, status: "SUSPENDED" }),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("treats an unchanged status as a no-op without an audit entry", async () => {
    const college = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const target = await createStudent(college.id);
    const actor = await actorForUser(admin.id);

    const updated = await changeUserStatus(actor, {
      targetUserId: target.user.id,
      status: "ACTIVE",
    });

    expect(updated.status).toBe("ACTIVE");
    expect(
      await prisma.auditLog.count({
        where: { action: "USER_STATUS_CHANGED", entityId: target.user.id },
      }),
    ).toBe(0);
  });

  it("rejects missing users, deleted users, and invalid status values", async () => {
    const college = await createCollege();
    const admin = await createCollegeAdmin(college.id);
    const actor = await actorForUser(admin.id);
    const deleted = await createStudent(college.id);
    await prisma.user.update({
      where: { id: deleted.user.id },
      data: { deletedAt: new Date() },
    });

    await expect(
      changeUserStatus(actor, {
        targetUserId: "00000000-0000-4000-8000-000000000000",
        status: "SUSPENDED",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      changeUserStatus(actor, { targetUserId: deleted.user.id, status: "SUSPENDED" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      changeUserStatus(actor, { targetUserId: deleted.user.id, status: "DELETED" }),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });
});

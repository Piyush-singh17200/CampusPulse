import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { loadActorContext } from "@/server/auth/actor";
import {
  assertActorActive,
  assertCollegeAdmin,
  assertStudent,
  assertSuperAdmin,
  isClubManagerFor,
} from "@/services/authorization";
import { resetDatabase } from "@tests/helpers/db";
import {
  actorForUser,
  createClub,
  createClubAdmin,
  createCollege,
  createCollegeAdmin,
  createStudent,
  createUser,
} from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

describe("trusted actor and RBAC helpers", () => {
  it("reloads role, college, and active club memberships from the database", async () => {
    const college = await createCollege();
    const user = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: user.id });
    await prisma.clubMembership.create({
      data: {
        collegeId: college.id,
        clubId: club.id,
        userId: user.id,
        role: "PRESIDENT",
        status: "ACTIVE",
      },
    });

    const actor = await actorForUser(user.id);

    expect(actor).toMatchObject({
      id: user.id,
      collegeId: college.id,
      role: "CLUB_ADMIN",
      status: "ACTIVE",
    });
    expect(actor.clubMemberships).toEqual([
      expect.objectContaining({ clubId: club.id, role: "PRESIDENT", status: "ACTIVE" }),
    ]);

    const otherCollege = await createCollege();
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "STUDENT", collegeId: otherCollege.id },
    });

    const reloaded = await loadActorContext(user.id);
    expect(reloaded).toMatchObject({ role: "STUDENT", collegeId: otherCollege.id });
  });

  it("fails closed for missing, deleted, and inactive actors", async () => {
    const college = await createCollege();
    const user = await createUser({ collegeId: college.id });

    expect(await loadActorContext("not-a-uuid")).toBeNull();
    expect(await loadActorContext("00000000-0000-4000-8000-000000000000")).toBeNull();

    await prisma.user.update({ where: { id: user.id }, data: { status: "DISABLED" } });
    expect(await loadActorContext(user.id)).toBeNull();

    await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", deletedAt: new Date() },
    });
    expect(await loadActorContext(user.id)).toBeNull();
  });

  it("enforces role and active-account checks", async () => {
    const college = await createCollege();
    const { user: student } = await createStudent(college.id);
    const studentActor = await actorForUser(student.id);
    const admin = await createCollegeAdmin(college.id);
    const adminActor = await actorForUser(admin.id);
    const superAdmin = await createUser({ role: "SUPER_ADMIN" });
    const superAdminActor = await actorForUser(superAdmin.id);

    expect(() => assertActorActive(studentActor)).not.toThrow();
    expect(() => assertStudent(studentActor)).not.toThrow();
    expect(() => assertStudent(adminActor)).toThrow();
    expect(() => assertCollegeAdmin(adminActor, college.id)).not.toThrow();
    expect(() => assertCollegeAdmin(adminActor, "00000000-0000-4000-8000-000000000000")).toThrow();
    expect(() => assertSuperAdmin(superAdminActor)).not.toThrow();
    expect(() => assertSuperAdmin(adminActor)).toThrow();

    expect(() => assertActorActive({ ...studentActor, status: "SUSPENDED" })).toThrow();
  });

  it("recognizes only active presidents and officers as club managers", async () => {
    const college = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: creator.id });
    const manager = await createClubAdmin({
      collegeId: college.id,
      clubId: club.id,
    });
    const managerActor = await actorForUser(manager.id);

    expect(isClubManagerFor(managerActor, club.id, college.id)).toBe(true);
    expect(isClubManagerFor(managerActor, club.id, "00000000-0000-4000-8000-000000000000")).toBe(
      false,
    );

    await prisma.clubMembership.updateMany({
      where: { userId: manager.id, clubId: club.id },
      data: { status: "SUSPENDED" },
    });

    const suspendedActor = await actorForUser(manager.id);
    expect(suspendedActor.clubMemberships).toEqual([]);
    expect(isClubManagerFor(suspendedActor, club.id, college.id)).toBe(false);
  });
});

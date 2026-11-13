import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { ActorNotAuthorizedError, DomainError, InvalidTransitionError } from "@/server/errors";
import type { EventStatus } from "@/generated/prisma/enums";
import type { PosterStorage } from "@/server/storage/poster-storage";
import { getEventPosterForActor, removeEventPoster, uploadEventPoster } from "@/services/posters";
import { resetDatabase } from "@tests/helpers/db";
import { validJpeg, validPng } from "@tests/helpers/images";
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

beforeEach(async () => {
  await resetDatabase();
});

function createMemoryStorage() {
  const files = new Map<string, Buffer>();
  const storage: PosterStorage = {
    async put(key, data) {
      files.set(key, Buffer.from(data));
    },
    async get(key) {
      return files.get(key) ?? null;
    },
    async delete(key) {
      files.delete(key);
    },
  };

  return { files, storage };
}

async function createPosterFixture(status: EventStatus = "DRAFT") {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const clubAdmin = await createClubAdmin({ collegeId: college.id, clubId: club.id });
  const event = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status,
  });
  const collegeAdmin = await createCollegeAdmin(college.id);
  const { user: student } = await createStudent(college.id);

  const otherClubCreator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const otherClub = await createClub({
    collegeId: college.id,
    createdById: otherClubCreator.id,
  });
  const otherClubAdmin = await createClubAdmin({
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
  const otherCollegeClubAdmin = await createClubAdmin({
    collegeId: otherCollege.id,
    clubId: otherCollegeClub.id,
  });
  const otherCollegeStudent = await createStudent(otherCollege.id);

  const superAdmin = await createSuperAdmin();

  return {
    college,
    club,
    event,
    student,
    otherClubAdmin,
    otherCollegeClubAdmin,
    otherCollegeStudent,
    clubAdminActor: await actorForUser(clubAdmin.id),
    collegeAdminActor: await actorForUser(collegeAdmin.id),
    studentActor: await actorForUser(student.id),
    otherClubAdminActor: await actorForUser(otherClubAdmin.id),
    otherCollegeClubAdminActor: await actorForUser(otherCollegeClubAdmin.id),
    otherCollegeStudentActor: await actorForUser(otherCollegeStudent.user.id),
    superAdminActor: await actorForUser(superAdmin.id),
  };
}

describe("poster service", () => {
  it("uploads a validated poster, stores the metadata, and audits the action", async () => {
    const { event, clubAdminActor } = await createPosterFixture();
    const { files, storage } = createMemoryStorage();
    const bytes = validPng();

    const poster = await uploadEventPoster(
      clubAdminActor,
      { eventId: event.id, bytes, altText: "Robotics showcase poster" },
      storage,
    );

    expect(poster).toMatchObject({
      eventId: event.id,
      collegeId: event.collegeId,
      mimeType: "image/png",
      byteSize: bytes.byteLength,
      width: 8,
      height: 6,
      altText: "Robotics showcase poster",
      isPrimary: true,
    });
    expect(files.get(poster.storageKey)).toEqual(bytes);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "EventPoster", entityId: poster.id },
    });
    expect(audit).toMatchObject({
      action: "POSTER_UPLOADED",
      actorUserId: clubAdminActor.id,
      collegeId: event.collegeId,
    });
    expect(audit?.metadata).toMatchObject({ eventId: event.id, previousPosterId: null });
  });

  it("replaces the primary poster, keeps one primary row, and deletes the old unreferenced file", async () => {
    const { event, clubAdminActor } = await createPosterFixture();
    const { files, storage } = createMemoryStorage();
    const first = await uploadEventPoster(
      clubAdminActor,
      { eventId: event.id, bytes: validPng() },
      storage,
    );
    const oldKey = first.storageKey;

    const second = await uploadEventPoster(
      clubAdminActor,
      { eventId: event.id, bytes: validJpeg(), altText: "Replacement poster" },
      storage,
    );

    expect(second.id).not.toBe(first.id);
    expect(second.mimeType).toBe("image/jpeg");
    expect(files.has(oldKey)).toBe(false);
    expect(files.has(second.storageKey)).toBe(true);

    const posters = await prisma.eventPoster.findMany({ where: { eventId: event.id } });
    expect(posters).toHaveLength(1);
    expect(posters[0]?.id).toBe(second.id);
    expect(posters[0]?.isPrimary).toBe(true);

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "EventPoster", entityId: second.id },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.map((audit) => audit.action)).toEqual(["POSTER_REPLACED"]);
    expect(audits[0]?.metadata).toMatchObject({ previousPosterId: first.id });
  });

  it("does not delete a replaced file that is still referenced by another poster row", async () => {
    const { event, clubAdminActor } = await createPosterFixture();
    const { files, storage } = createMemoryStorage();
    const first = await uploadEventPoster(
      clubAdminActor,
      { eventId: event.id, bytes: validPng() },
      storage,
    );
    const oldKey = first.storageKey;

    await prisma.eventPoster.create({
      data: {
        collegeId: event.collegeId,
        eventId: event.id,
        storageKey: oldKey,
        mimeType: "image/png",
        byteSize: validPng().byteLength,
        width: 8,
        height: 6,
        isPrimary: false,
      },
    });

    const second = await uploadEventPoster(
      clubAdminActor,
      { eventId: event.id, bytes: validJpeg() },
      storage,
    );

    expect(files.has(oldKey)).toBe(true);
    expect(files.has(second.storageKey)).toBe(true);
  });

  it("removes the primary poster and its file, and is idempotent when no poster exists", async () => {
    const { event, clubAdminActor } = await createPosterFixture();
    const { files, storage } = createMemoryStorage();
    const poster = await uploadEventPoster(
      clubAdminActor,
      { eventId: event.id, bytes: validPng() },
      storage,
    );

    const removed = await removeEventPoster(clubAdminActor, { eventId: event.id }, storage);

    expect(removed).toEqual({ removed: true });
    expect(files.has(poster.storageKey)).toBe(false);
    expect(await prisma.eventPoster.count({ where: { eventId: event.id } })).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "EventPoster", entityId: poster.id, action: "POSTER_REMOVED" },
    });
    expect(audit).toMatchObject({ actorUserId: clubAdminActor.id, collegeId: event.collegeId });

    const again = await removeEventPoster(clubAdminActor, { eventId: event.id }, storage);
    expect(again).toEqual({ removed: false });
    expect(
      await prisma.auditLog.count({
        where: { entityType: "EventPoster", action: "POSTER_REMOVED" },
      }),
    ).toBe(1);
  });

  it("allows poster changes only for draft, rejected, and published events", async () => {
    for (const status of ["DRAFT", "REJECTED", "PUBLISHED"] as const) {
      const { event, clubAdminActor } = await createPosterFixture(status);
      const { storage } = createMemoryStorage();

      await expect(
        uploadEventPoster(clubAdminActor, { eventId: event.id, bytes: validPng() }, storage),
      ).resolves.toMatchObject({ eventId: event.id });
    }

    for (const status of ["PENDING_APPROVAL", "CANCELLED", "COMPLETED"] as const) {
      const { event, clubAdminActor } = await createPosterFixture(status);
      const { storage } = createMemoryStorage();

      await expect(
        uploadEventPoster(clubAdminActor, { eventId: event.id, bytes: validPng() }, storage),
      ).rejects.toBeInstanceOf(InvalidTransitionError);
    }
  });

  it("rejects poster changes from unauthorized roles and other tenants", async () => {
    const {
      event,
      studentActor,
      collegeAdminActor,
      otherClubAdminActor,
      otherCollegeClubAdminActor,
      superAdminActor,
    } = await createPosterFixture();
    const { storage } = createMemoryStorage();

    for (const actor of [
      studentActor,
      collegeAdminActor,
      otherClubAdminActor,
      otherCollegeClubAdminActor,
      superAdminActor,
    ]) {
      await expect(
        uploadEventPoster(actor, { eventId: event.id, bytes: validPng() }, storage),
      ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
    }

    expect(await prisma.eventPoster.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityType: "EventPoster" } })).toBe(0);
  });

  it("rejects poster changes for an inactive or deleted club", async () => {
    const { event, club, clubAdminActor } = await createPosterFixture();
    const { storage } = createMemoryStorage();

    await prisma.club.update({ where: { id: club.id }, data: { status: "SUSPENDED" } });

    await expect(
      uploadEventPoster(clubAdminActor, { eventId: event.id, bytes: validPng() }, storage),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);

    await prisma.club.update({
      where: { id: club.id },
      data: { status: "ACTIVE", deletedAt: new Date() },
    });

    await expect(
      uploadEventPoster(clubAdminActor, { eventId: event.id, bytes: validPng() }, storage),
    ).rejects.toBeInstanceOf(ActorNotAuthorizedError);
  });

  it("reports a storage error and leaves no poster or audit when the write fails", async () => {
    const { event, clubAdminActor } = await createPosterFixture();
    const { files, storage } = createMemoryStorage();
    storage.put = async () => {
      throw new DomainError("STORAGE_ERROR", "Storage unavailable.", 500);
    };

    await expect(
      uploadEventPoster(clubAdminActor, { eventId: event.id, bytes: validPng() }, storage),
    ).rejects.toMatchObject({ code: "STORAGE_ERROR" });

    expect(files.size).toBe(0);
    expect(await prisma.eventPoster.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityType: "EventPoster" } })).toBe(0);
  });

  it("cleans up the new file when the database transaction fails after the write", async () => {
    const { event, clubAdminActor } = await createPosterFixture();
    const { files, storage } = createMemoryStorage();
    const originalPut = storage.put;
    storage.put = async (key, data) => {
      await originalPut(key, data);
      // Simulate the event disappearing between the pre-check and the
      // transaction's authoritative reload.
      await prisma.event.delete({ where: { id: event.id } });
    };

    await expect(
      uploadEventPoster(clubAdminActor, { eventId: event.id, bytes: validPng() }, storage),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(files.size).toBe(0);
    expect(await prisma.eventPoster.count()).toBe(0);
  });

  it("delivers published posters to same-college students but not to other colleges", async () => {
    const {
      event,
      clubAdminActor,
      studentActor,
      otherClubAdminActor,
      otherCollegeStudentActor,
      superAdminActor,
    } = await createPosterFixture("PUBLISHED");
    const { storage } = createMemoryStorage();
    const poster = await uploadEventPoster(
      clubAdminActor,
      { eventId: event.id, bytes: validPng() },
      storage,
    );

    await expect(getEventPosterForActor(studentActor, poster.id, storage)).resolves.toMatchObject({
      id: poster.id,
      mimeType: "image/png",
    });
    await expect(
      getEventPosterForActor(otherClubAdminActor, poster.id, storage),
    ).resolves.toMatchObject({ id: poster.id });
    await expect(
      getEventPosterForActor(otherCollegeStudentActor, poster.id, storage),
    ).resolves.toBeNull();
    await expect(
      getEventPosterForActor(superAdminActor, poster.id, storage),
    ).resolves.toMatchObject({ id: poster.id });
  });

  it("keeps draft posters private to the owning club manager, college admin, and platform admin", async () => {
    const {
      event,
      clubAdminActor,
      studentActor,
      collegeAdminActor,
      otherClubAdminActor,
      superAdminActor,
    } = await createPosterFixture("DRAFT");
    const { storage } = createMemoryStorage();
    const poster = await uploadEventPoster(
      clubAdminActor,
      { eventId: event.id, bytes: validPng() },
      storage,
    );

    await expect(getEventPosterForActor(clubAdminActor, poster.id, storage)).resolves.toMatchObject(
      {
        id: poster.id,
      },
    );
    await expect(
      getEventPosterForActor(collegeAdminActor, poster.id, storage),
    ).resolves.toMatchObject({ id: poster.id });
    await expect(
      getEventPosterForActor(superAdminActor, poster.id, storage),
    ).resolves.toMatchObject({ id: poster.id });
    await expect(getEventPosterForActor(studentActor, poster.id, storage)).resolves.toBeNull();
    await expect(
      getEventPosterForActor(otherClubAdminActor, poster.id, storage),
    ).resolves.toBeNull();

    await prisma.club.update({ where: { id: event.clubId }, data: { deletedAt: new Date() } });

    await expect(getEventPosterForActor(clubAdminActor, poster.id, storage)).resolves.toBeNull();
    await expect(
      getEventPosterForActor(collegeAdminActor, poster.id, storage),
    ).resolves.toMatchObject({ id: poster.id });
  });

  it("returns null for missing files, invalid ids, and cross-tenant requests", async () => {
    const { event, clubAdminActor, otherCollegeStudentActor } =
      await createPosterFixture("PUBLISHED");
    const { files, storage } = createMemoryStorage();
    const poster = await uploadEventPoster(
      clubAdminActor,
      { eventId: event.id, bytes: validPng() },
      storage,
    );

    files.delete(poster.storageKey);

    await expect(getEventPosterForActor(clubAdminActor, poster.id, storage)).resolves.toBeNull();
    await expect(getEventPosterForActor(clubAdminActor, "not-a-uuid", storage)).resolves.toBeNull();
    await expect(
      getEventPosterForActor(otherCollegeStudentActor, poster.id, storage),
    ).resolves.toBeNull();
  });
});

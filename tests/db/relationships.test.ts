import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { resetDatabase } from "@tests/helpers/db";
import {
  createClub,
  createCollege,
  createEvent,
  createStudent,
  createUser,
} from "@tests/helpers/factories";

beforeEach(async () => {
  await resetDatabase();
});

async function expectForeignKeyFailure(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({ code: "P2003" });
}

describe("tenant relationships", () => {
  it("stores college/user ownership and student profile ownership", async () => {
    const college = await createCollege();
    const { user, profile } = await createStudent(college.id);

    expect(user.collegeId).toBe(college.id);
    expect(profile.collegeId).toBe(college.id);
    expect(profile.userId).toBe(user.id);

    const scopedProfile = await prisma.studentProfile.findFirst({
      where: { id: profile.id, collegeId: college.id },
    });
    expect(scopedProfile?.id).toBe(profile.id);
  });

  it("scopes clubs and events by college", async () => {
    const college = await createCollege();
    const otherCollege = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: creator.id });
    const event = await createEvent({
      collegeId: college.id,
      clubId: club.id,
      createdById: creator.id,
      status: "PUBLISHED",
    });

    await expect(
      prisma.club.findFirst({ where: { id: club.id, collegeId: otherCollege.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.event.findFirst({ where: { id: event.id, collegeId: otherCollege.id } }),
    ).resolves.toBeNull();
  });

  it("accepts valid composite relationships", async () => {
    const college = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: creator.id });
    const { profile } = await createStudent(college.id);
    const event = await createEvent({
      collegeId: college.id,
      clubId: club.id,
      createdById: creator.id,
      status: "PUBLISHED",
    });

    const registration = await prisma.eventRegistration.create({
      data: {
        collegeId: college.id,
        eventId: event.id,
        studentProfileId: profile.id,
        status: "CONFIRMED",
      },
    });

    expect(registration.eventId).toBe(event.id);
    expect(registration.studentProfileId).toBe(profile.id);
  });

  it("rejects a club creator from another college", async () => {
    const college = await createCollege();
    const otherCollege = await createCollege();
    const creator = await createUser({ collegeId: otherCollege.id, role: "CLUB_ADMIN" });

    await expectForeignKeyFailure(
      prisma.club.create({
        data: {
          collegeId: college.id,
          createdById: creator.id,
          name: "Cross-college club",
          slug: "cross-college-club",
          status: "PENDING",
        },
      }),
    );
  });

  it("rejects an event whose club belongs to another college", async () => {
    const college = await createCollege();
    const otherCollege = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const otherCreator = await createUser({
      collegeId: otherCollege.id,
      role: "CLUB_ADMIN",
    });
    const otherClub = await createClub({
      collegeId: otherCollege.id,
      createdById: otherCreator.id,
    });

    await expectForeignKeyFailure(
      prisma.event.create({
        data: {
          collegeId: college.id,
          clubId: otherClub.id,
          createdById: creator.id,
          title: "Cross-college event",
          slug: "cross-college-event",
          startsAt: new Date(Date.now() + 86_400_000),
          endsAt: new Date(Date.now() + 90_000_000),
          venueName: "Test Hall",
          status: "DRAFT",
        },
      }),
    );
  });

  it("rejects a registration whose event and student belong to different colleges", async () => {
    const college = await createCollege();
    const otherCollege = await createCollege();
    const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const club = await createClub({ collegeId: college.id, createdById: creator.id });
    const event = await createEvent({
      collegeId: college.id,
      clubId: club.id,
      createdById: creator.id,
      status: "PUBLISHED",
    });
    const { profile } = await createStudent(otherCollege.id);

    await expectForeignKeyFailure(
      prisma.eventRegistration.create({
        data: {
          collegeId: otherCollege.id,
          eventId: event.id,
          studentProfileId: profile.id,
          status: "CONFIRMED",
        },
      }),
    );
  });
});

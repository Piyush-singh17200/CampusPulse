import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { getStudentRecommendations } from "@/services/recommendations";
import { resetDatabase } from "@tests/helpers/db";
import {
  actorForUser,
  createCategory,
  createClub,
  createCollege,
  createEvent,
  createStudent,
  createUser,
  unique,
} from "@tests/helpers/factories";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createRecommendationFixture() {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const { user, profile } = await createStudent(college.id);
  const actor = await actorForUser(user.id);
  const interest = await prisma.interest.create({
    data: {
      name: `Robotics ${unique("interest")}`,
      slug: unique("robotics"),
    },
  });
  await prisma.studentInterest.create({
    data: {
      collegeId: college.id,
      studentProfileId: profile.id,
      interestId: interest.id,
    },
  });
  const category = await createCategory(college.id);

  const priorEvent = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt: new Date(Date.now() - 10 * DAY_MS),
  });
  await prisma.eventCategory.create({
    data: { collegeId: college.id, eventId: priorEvent.id, categoryId: category.id },
  });
  await prisma.eventRegistration.create({
    data: {
      collegeId: college.id,
      eventId: priorEvent.id,
      studentProfileId: profile.id,
      status: "CONFIRMED",
    },
  });

  const candidate = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt: new Date(Date.now() + 10 * DAY_MS),
    registrationOpensAt: new Date(Date.now() - DAY_MS),
    registrationDeadline: new Date(Date.now() + 5 * DAY_MS),
  });
  await prisma.eventInterest.create({
    data: { collegeId: college.id, eventId: candidate.id, interestId: interest.id },
  });
  await prisma.eventCategory.create({
    data: { collegeId: college.id, eventId: candidate.id, categoryId: category.id },
  });

  const otherStudents = await Promise.all([
    createStudent(college.id),
    createStudent(college.id),
    createStudent(college.id),
  ]);
  for (const other of otherStudents) {
    await prisma.eventRegistration.create({
      data: {
        collegeId: college.id,
        eventId: candidate.id,
        studentProfileId: other.profile.id,
        status: "CONFIRMED",
      },
    });
  }

  const registeredEvent = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt: new Date(Date.now() + 6 * DAY_MS),
  });
  await prisma.eventRegistration.create({
    data: {
      collegeId: college.id,
      eventId: registeredEvent.id,
      studentProfileId: profile.id,
      status: "CONFIRMED",
    },
  });

  const savedEvent = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt: new Date(Date.now() + 7 * DAY_MS),
  });
  await prisma.savedEvent.create({
    data: {
      collegeId: college.id,
      eventId: savedEvent.id,
      studentProfileId: profile.id,
    },
  });

  const fullEvent = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
    startsAt: new Date(Date.now() + 8 * DAY_MS),
    capacity: 1,
  });
  await prisma.eventRegistration.create({
    data: {
      collegeId: college.id,
      eventId: fullEvent.id,
      studentProfileId: otherStudents[0].profile.id,
      status: "CONFIRMED",
    },
  });

  const otherCollege = await createCollege();
  const otherCreator = await createUser({ collegeId: otherCollege.id, role: "CLUB_ADMIN" });
  const otherClub = await createClub({
    collegeId: otherCollege.id,
    createdById: otherCreator.id,
  });
  const otherCollegeEvent = await createEvent({
    collegeId: otherCollege.id,
    clubId: otherClub.id,
    createdById: otherCreator.id,
    status: "PUBLISHED",
    startsAt: new Date(Date.now() + 4 * DAY_MS),
  });

  return {
    college,
    profile,
    actor,
    interest,
    category,
    candidate,
    registeredEvent,
    savedEvent,
    fullEvent,
    otherCollegeEvent,
  };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("student recommendations", () => {
  it("ranks eligible events deterministically with real, explainable signals", async () => {
    const { actor, candidate, interest, category } = await createRecommendationFixture();

    const first = await getStudentRecommendations(actor, { limit: 4 });
    const second = await getStudentRecommendations(actor, { limit: 4 });

    expect(first.reason).toBeNull();
    expect(first.recommendations.length).toBeGreaterThan(0);
    expect(first.recommendations.map((entry) => entry.event.id)).toEqual(
      second.recommendations.map((entry) => entry.event.id),
    );

    const top = first.recommendations[0];
    expect(top.event.id).toBe(candidate.id);
    expect(top.score).toBeGreaterThan(0);
    expect(top.explanations).toContain(`Matches your interest in ${interest.name}.`);
    expect(top.explanations).toContain(`Matches ${category.name}, a category you have explored.`);
    expect(top.explanations).toContain("Popular among students at your college.");
    expect(top.signals.interestMatch).toContain(interest.name);
    expect(top.signals.categoryMatch).toContain(category.name);
    expect(top.signals.popularity).toBe(3);
  });

  it("excludes registered, saved, full, and other-college events", async () => {
    const { actor, candidate, registeredEvent, savedEvent, fullEvent, otherCollegeEvent } =
      await createRecommendationFixture();

    const result = await getStudentRecommendations(actor, { limit: 12 });
    const ids = result.recommendations.map((entry) => entry.event.id);

    expect(ids).toContain(candidate.id);
    expect(ids).not.toContain(registeredEvent.id);
    expect(ids).not.toContain(savedEvent.id);
    expect(ids).not.toContain(fullEvent.id);
    expect(ids).not.toContain(otherCollegeEvent.id);
  });

  it("returns an honest empty-state reason when no eligible events exist", async () => {
    const college = await createCollege();
    const { user } = await createStudent(college.id);
    const actor = await actorForUser(user.id);

    const result = await getStudentRecommendations(actor);

    expect(result.recommendations).toEqual([]);
    expect(result.reason).toBe(
      "There are no upcoming events open for registration at your college right now.",
    );
  });
});

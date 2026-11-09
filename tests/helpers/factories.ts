import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import type { EventStatus, UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";
import { loadActorContext } from "@/server/auth/actor";
import type { AuthenticatedActor } from "@/server/auth/types";

export function unique(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function createCollege(overrides: Partial<Prisma.CollegeUncheckedCreateInput> = {}) {
  return prisma.college.create({
    data: {
      name: `Test College ${randomUUID().slice(0, 8)}`,
      slug: unique("college"),
      timezone: "Asia/Kolkata",
      ...overrides,
    },
  });
}

export async function createUser(
  overrides: Partial<Prisma.UserUncheckedCreateInput> & {
    collegeId?: string | null;
    role?: UserRole;
  } = {},
) {
  return prisma.user.create({
    data: {
      email: `${unique("user")}@example.test`,
      name: "Test User",
      role: "STUDENT",
      status: "ACTIVE",
      ...overrides,
    },
  });
}

export async function actorForUser(userId: string): Promise<AuthenticatedActor> {
  const actor = await loadActorContext(userId);

  if (!actor) {
    throw new Error("The test actor is not active or does not exist.");
  }

  return actor;
}

export async function createStudent(
  collegeId: string,
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  const user = await createUser({
    collegeId,
    role: "STUDENT",
    ...overrides,
  });

  const profile = await prisma.studentProfile.create({
    data: {
      userId: user.id,
      collegeId,
      rollNumber: unique("roll"),
      department: "Computer Science",
      graduationYear: 2027,
    },
  });

  return { user, profile };
}

export async function createCollegeAdmin(collegeId: string) {
  return createUser({
    collegeId,
    role: "COLLEGE_ADMIN",
    name: "Test College Admin",
  });
}

export async function createSuperAdmin() {
  return createUser({
    collegeId: null,
    role: "SUPER_ADMIN",
    name: "Test Platform Admin",
  });
}

export async function createClub(input: {
  collegeId: string;
  createdById: string;
  status?: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "ARCHIVED";
  name?: string;
}) {
  return prisma.club.create({
    data: {
      collegeId: input.collegeId,
      createdById: input.createdById,
      name: input.name ?? `Test Club ${randomUUID().slice(0, 8)}`,
      slug: unique("club"),
      status: input.status ?? "ACTIVE",
      approvedAt: input.status === "PENDING" ? null : new Date(),
    },
  });
}

export async function createClubAdmin(input: {
  collegeId: string;
  clubId: string;
  membershipRole?: "PRESIDENT" | "OFFICER" | "MEMBER";
}) {
  const user = await createUser({
    collegeId: input.collegeId,
    role: "CLUB_ADMIN",
    name: "Test Club Admin",
  });

  await prisma.clubMembership.create({
    data: {
      collegeId: input.collegeId,
      clubId: input.clubId,
      userId: user.id,
      role: input.membershipRole ?? "PRESIDENT",
      status: "ACTIVE",
    },
  });

  return user;
}

export async function createCategory(collegeId: string) {
  return prisma.category.create({
    data: {
      collegeId,
      name: "Test Category",
      slug: unique("category"),
    },
  });
}

export async function createEvent(input: {
  collegeId: string;
  clubId: string;
  createdById: string;
  status?: EventStatus;
  startsAt?: Date;
  endsAt?: Date;
  registrationOpensAt?: Date | null;
  registrationDeadline?: Date | null;
  capacity?: number | null;
}) {
  const startsAt = input.startsAt ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const endsAt = input.endsAt ?? new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  const status = input.status ?? "PUBLISHED";
  const now = new Date();
  const registrationDeadline =
    input.registrationDeadline === undefined
      ? new Date(startsAt.getTime() - 60 * 60 * 1000)
      : input.registrationDeadline;
  const registrationOpensAt =
    input.registrationOpensAt === undefined
      ? new Date((registrationDeadline ?? startsAt).getTime() - 2 * 24 * 60 * 60 * 1000)
      : input.registrationOpensAt;

  return prisma.event.create({
    data: {
      collegeId: input.collegeId,
      clubId: input.clubId,
      createdById: input.createdById,
      title: `Test Event ${randomUUID().slice(0, 8)}`,
      slug: unique("event"),
      summary: "A test event.",
      description: "A test event used by the database integration suite.",
      status,
      startsAt,
      endsAt,
      registrationOpensAt,
      registrationDeadline,
      venueName: "Test Hall",
      capacity: input.capacity === undefined ? 10 : input.capacity,
      publishedAt: status === "PUBLISHED" || status === "COMPLETED" ? now : null,
      rejectedAt: status === "REJECTED" ? now : null,
      cancellationReason: status === "CANCELLED" ? "Test cancellation" : null,
      cancelledAt: status === "CANCELLED" ? now : null,
      completedAt: status === "COMPLETED" ? now : null,
    },
  });
}

export async function createPublishedEventFixture() {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const event = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: creator.id,
    status: "PUBLISHED",
  });
  const collegeAdmin = await createCollegeAdmin(college.id);

  return { college, creator, club, event, collegeAdmin };
}

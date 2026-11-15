import "server-only";

import type { Prisma } from "@/generated/prisma/client";

export async function getActiveClubManagerIds(
  tx: Prisma.TransactionClient,
  clubId: string,
  collegeId: string,
): Promise<string[]> {
  const memberships = await tx.clubMembership.findMany({
    where: {
      clubId,
      collegeId,
      status: "ACTIVE",
      role: { in: ["PRESIDENT", "OFFICER"] },
    },
    select: { userId: true },
  });

  const userIds = [...new Set(memberships.map((membership) => membership.userId))];

  if (userIds.length === 0) {
    return [];
  }

  const activeUsers = await tx.user.findMany({
    where: {
      id: { in: userIds },
      collegeId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });

  return activeUsers.map((user) => user.id);
}

export async function getConfirmedRegistrationUserIds(
  tx: Prisma.TransactionClient,
  eventId: string,
  collegeId: string,
): Promise<string[]> {
  const registrations = await tx.eventRegistration.findMany({
    where: { eventId, collegeId, status: "CONFIRMED" },
    select: { studentProfile: { select: { userId: true } } },
  });

  return [...new Set(registrations.map((registration) => registration.studentProfile.userId))];
}

export async function getAttendedRegistrationUserIds(
  tx: Prisma.TransactionClient,
  eventId: string,
  collegeId: string,
): Promise<string[]> {
  const registrations = await tx.eventRegistration.findMany({
    where: { eventId, collegeId, status: "ATTENDED" },
    select: { studentProfile: { select: { userId: true } } },
  });

  return [...new Set(registrations.map((registration) => registration.studentProfile.userId))];
}

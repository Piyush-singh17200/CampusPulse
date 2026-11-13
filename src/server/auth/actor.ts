import "server-only";

import { prisma } from "@/server/db/client";

import type { AuthenticatedActor } from "./types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Loads a fresh actor context from PostgreSQL. Session identity is only a user
 * ID; role, college, status, and club memberships are always re-read from the
 * database so stale or forged browser values cannot affect authorization.
 */
export async function loadActorContext(userId: string): Promise<AuthenticatedActor | null> {
  if (!uuidPattern.test(userId)) {
    return null;
  }

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      collegeId: true,
      role: true,
      status: true,
      deletedAt: true,
      college: {
        select: { status: true, deletedAt: true },
      },
      clubMemberships: {
        where: { status: "ACTIVE" },
        select: { clubId: true, role: true, status: true },
      },
    },
  });

  if (!actor || actor.deletedAt || actor.status !== "ACTIVE") {
    return null;
  }

  if (actor.college && (actor.college.deletedAt || actor.college.status !== "ACTIVE")) {
    return null;
  }

  return actor;
}

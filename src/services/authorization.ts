import "server-only";

import { ActorNotAuthorizedError } from "@/server/errors";

import type { AuthenticatedActor } from "@/server/auth/types";

export type { ActorMembership, AuthenticatedActor } from "@/server/auth/types";

export function assertActorActive(actor: AuthenticatedActor): void {
  if (actor.deletedAt || actor.status !== "ACTIVE") {
    throw new ActorNotAuthorizedError("The authenticated actor is not active.");
  }
}

export function assertStudent(actor: AuthenticatedActor): void {
  assertActorActive(actor);

  if (actor.role !== "STUDENT") {
    throw new ActorNotAuthorizedError("A student account is required for this action.");
  }
}

export function isSuperAdmin(actor: AuthenticatedActor): boolean {
  return actor.role === "SUPER_ADMIN";
}

export function assertCollegeAdmin(actor: AuthenticatedActor, collegeId: string): void {
  assertActorActive(actor);

  if (actor.role !== "COLLEGE_ADMIN" || actor.collegeId !== collegeId) {
    throw new ActorNotAuthorizedError("A college administrator for this college is required.");
  }
}

export function assertSuperAdmin(actor: AuthenticatedActor): void {
  assertActorActive(actor);

  if (!isSuperAdmin(actor)) {
    throw new ActorNotAuthorizedError("A platform administrator is required.");
  }
}

export function isClubManagerFor(
  actor: AuthenticatedActor,
  clubId: string,
  collegeId: string,
): boolean {
  if (actor.role !== "CLUB_ADMIN" || actor.collegeId !== collegeId) {
    return false;
  }

  return actor.clubMemberships.some(
    (membership) =>
      membership.clubId === clubId &&
      membership.status === "ACTIVE" &&
      (membership.role === "PRESIDENT" || membership.role === "OFFICER"),
  );
}

export function assertClubManagerFor(
  actor: AuthenticatedActor,
  clubId: string,
  collegeId: string,
): void {
  assertActorActive(actor);

  if (!isClubManagerFor(actor, clubId, collegeId)) {
    throw new ActorNotAuthorizedError(
      "Only an active president or officer of this club may perform this action.",
    );
  }
}

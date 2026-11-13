import "server-only";

import type { UserRole } from "@/generated/prisma/enums";
import { ActorNotAuthorizedError } from "@/server/errors";
import type { AuthenticatedActor } from "@/server/auth/types";
import { assertActorActive, isClubManagerFor, isSuperAdmin } from "@/services/authorization";

export type DashboardRole = Extract<
  UserRole,
  "STUDENT" | "CLUB_ADMIN" | "COLLEGE_ADMIN" | "SUPER_ADMIN"
>;

export function assertDashboardRole(actor: AuthenticatedActor, role: DashboardRole): void {
  assertActorActive(actor);

  if (actor.role !== role) {
    throw new ActorNotAuthorizedError(`A ${role.toLowerCase()} dashboard is required.`);
  }
}

export function assertStudentDashboard(actor: AuthenticatedActor): void {
  assertDashboardRole(actor, "STUDENT");

  if (!actor.collegeId) {
    throw new ActorNotAuthorizedError("A student college context is required.");
  }
}

export function assertClubDashboard(actor: AuthenticatedActor): void {
  assertDashboardRole(actor, "CLUB_ADMIN");

  if (!actor.collegeId) {
    throw new ActorNotAuthorizedError("A club administrator college context is required.");
  }

  if (
    !actor.clubMemberships.some(
      (membership) =>
        membership.status === "ACTIVE" &&
        (membership.role === "PRESIDENT" || membership.role === "OFFICER"),
    )
  ) {
    throw new ActorNotAuthorizedError("An active club manager membership is required.");
  }
}

export function assertCollegeDashboard(actor: AuthenticatedActor): string {
  assertDashboardRole(actor, "COLLEGE_ADMIN");

  if (!actor.collegeId) {
    throw new ActorNotAuthorizedError("A college administrator college context is required.");
  }

  return actor.collegeId;
}

export function assertPlatformDashboard(actor: AuthenticatedActor): void {
  assertDashboardRole(actor, "SUPER_ADMIN");
}

export function managedClubIds(actor: AuthenticatedActor): string[] {
  if (actor.role !== "CLUB_ADMIN") {
    return [];
  }

  return actor.clubMemberships
    .filter(
      (membership) =>
        membership.status === "ACTIVE" &&
        (membership.role === "PRESIDENT" || membership.role === "OFFICER"),
    )
    .map((membership) => membership.clubId);
}

export function assertManagedClub(
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

export function canManageClub(
  actor: AuthenticatedActor,
  clubId: string,
  collegeId: string,
): boolean {
  return isClubManagerFor(actor, clubId, collegeId);
}

export function assertCollegeScope(actor: AuthenticatedActor, collegeId: string): void {
  assertActorActive(actor);

  if (isSuperAdmin(actor)) {
    return;
  }

  if (actor.role !== "COLLEGE_ADMIN" || actor.collegeId !== collegeId) {
    throw new ActorNotAuthorizedError("A college administrator for this college is required.");
  }
}

import "server-only";

import { headers } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";

import type { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";
import {
  ActorNotAuthorizedError,
  AuthenticationRequiredError,
  DomainError,
  TenantIsolationError,
} from "@/server/errors";

import { loadActorContext } from "./actor";
import { auth } from "./auth";
import type { AuthenticatedUser } from "./types";

/**
 * Resolves the current user from Better Auth's verified, database-backed
 * session. The session is not trusted beyond its user ID: role, college, and
 * membership state are reloaded from PostgreSQL.
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  // Force request-time rendering for any page or layout that resolves the
  // session. This prevents Next.js from prerendering authenticated screens and
  // also makes the dependency explicit if the auth implementation changes.
  await connection();

  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";

  // Performance optimization: If no session cookies exist in the incoming request,
  // the visitor is anonymous. We return null immediately without making a slow
  // network round-trip to the remote PostgreSQL database.
  if (
    !cookieHeader.includes("better-auth.session_token") &&
    !cookieHeader.includes("__Secure-better-auth.session_token") &&
    !cookieHeader.includes("better-auth")
  ) {
    return null;
  }

  let session: Awaited<ReturnType<typeof auth.api.getSession>>;

  try {
    session = await auth.api.getSession({
      headers: requestHeaders,
      query: { disableCookieCache: true },
    });
  } catch {
    // Neon PostgreSQL can drop idle connections or pause compute nodes.
    // Retrying once with a fresh connection prevents unexpected session dropouts.
    try {
      session = await auth.api.getSession({
        headers: requestHeaders,
        query: { disableCookieCache: true },
      });
    } catch {
      return null;
    }
  }

  if (!session?.user?.id || !session.session?.id) {
    return null;
  }

  const actor = await loadActorContext(session.user.id);

  if (!actor) {
    return null;
  }

  return {
    ...actor,
    name: session.user.name,
    email: session.user.email,
    sessionId: session.session.id,
    sessionExpiresAt: session.session.expiresAt,
  };
});

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user;
}

export async function requireRole(...roles: readonly UserRole[]): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();

  if (!roles.includes(user.role)) {
    throw new ActorNotAuthorizedError();
  }

  return user;
}

export async function requireStudent(): Promise<AuthenticatedUser> {
  return requireRole("STUDENT");
}

export async function requireCollegeAccess(collegeId: string): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();

  if (user.role === "SUPER_ADMIN") {
    return user;
  }

  if (!user.collegeId || user.collegeId !== collegeId) {
    throw new ActorNotAuthorizedError("You do not have access to this college.");
  }

  return user;
}

export async function requireCollegeAdmin(collegeId: string): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();

  if (user.role === "SUPER_ADMIN") {
    return user;
  }

  if (user.role !== "COLLEGE_ADMIN" || user.collegeId !== collegeId) {
    throw new ActorNotAuthorizedError("A college administrator for this college is required.");
  }

  return user;
}

export async function requirePlatformAdmin(): Promise<AuthenticatedUser> {
  return requireRole("SUPER_ADMIN");
}

export type ClubAccessOptions = {
  manager?: boolean;
};

export async function requireClubAccess(
  clubId: string,
  options: ClubAccessOptions = {},
): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();
  const club = await prisma.club.findFirst({
    where: { id: clubId, deletedAt: null },
    select: { id: true, collegeId: true },
  });

  if (!club) {
    throw new DomainError("NOT_FOUND", "The requested club does not exist.", 404);
  }

  if (user.role === "SUPER_ADMIN") {
    return user;
  }

  if (!user.collegeId || user.collegeId !== club.collegeId) {
    // Do not confirm the existence of a club in another tenant.
    throw new TenantIsolationError();
  }

  const membership = user.clubMemberships.find((item) => item.clubId === clubId);

  if (!membership) {
    throw new ActorNotAuthorizedError("You are not an active member of this club.");
  }

  if (options.manager) {
    if (user.role !== "CLUB_ADMIN" || !["PRESIDENT", "OFFICER"].includes(membership.role)) {
      throw new ActorNotAuthorizedError(
        "Only an active president or officer of this club may perform this action.",
      );
    }
  }

  return user;
}

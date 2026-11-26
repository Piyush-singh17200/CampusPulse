import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { dashboardPathForRole } from "@/lib/roles";
import type { UserRole } from "@/generated/prisma/enums";
import { auth } from "./auth";
import { getCurrentUser } from "./session";

/**
 * Route-level guard for authenticated dashboard shells. The layout and every
 * protected page still call their own authorization helpers; this only keeps
 * users in the correct role workspace and sends disabled sessions to the safe
 * account-disabled screen.
 */
export async function requireDashboardRole(role: UserRole) {
  const user = await getCurrentUser();

  if (!user) {
    let hasSession = false;

    try {
      const session = await auth.api.getSession({
        headers: await headers(),
        query: { disableCookieCache: true },
      });
      hasSession = Boolean(session?.user);
    } catch {
      hasSession = false;
    }

    redirect(hasSession ? "/account-disabled" : "/login");
  }

  if (user.role !== role) {
    redirect(dashboardPathForRole(user.role));
  }

  if (role !== "SUPER_ADMIN" && !user.collegeId) {
    redirect("/unauthorized");
  }

  return user;
}

export async function requireAnyDashboardRole(roles: UserRole[]) {
  const user = await getCurrentUser();

  if (!user) {
    let hasSession = false;

    try {
      const session = await auth.api.getSession({
        headers: await headers(),
        query: { disableCookieCache: true },
      });
      hasSession = Boolean(session?.user);
    } catch {
      hasSession = false;
    }

    redirect(hasSession ? "/account-disabled" : "/login");
  }

  if (!roles.includes(user.role)) {
    redirect(dashboardPathForRole(user.role));
  }

  if (user.role !== "SUPER_ADMIN" && !user.collegeId) {
    redirect("/unauthorized");
  }

  return user;
}

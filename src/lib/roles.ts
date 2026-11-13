import type { UserRole } from "@/generated/prisma/enums";

export const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: "Student",
  CLUB_ADMIN: "Club administrator",
  COLLEGE_ADMIN: "College administrator",
  SUPER_ADMIN: "Platform administrator",
};

export const DASHBOARD_PATHS: Record<UserRole, string> = {
  STUDENT: "/student",
  CLUB_ADMIN: "/club",
  COLLEGE_ADMIN: "/college",
  SUPER_ADMIN: "/platform",
};

export function dashboardPathForRole(role: UserRole): string {
  return DASHBOARD_PATHS[role];
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import { prisma } from "@/server/db/client";
import { requireDashboardRole } from "@/server/auth/page-guard";

export const metadata: Metadata = {
  title: "College administration",
  robots: { index: false, follow: false },
};

const navItems: DashboardNavItem[] = [
  { href: "/college", label: "Overview", icon: "overview", exact: true, group: "Today" },
  { href: "/college/events", label: "Events", icon: "events", group: "Moderation" },
  { href: "/college/approvals", label: "Approvals", icon: "attendance", group: "Moderation" },
  { href: "/college/clubs", label: "Clubs", icon: "clubs", group: "Moderation" },
  { href: "/college/users", label: "Users", icon: "users", group: "Moderation" },
  { href: "/college/feedback", label: "Feedback", icon: "feedback", group: "Insight & control" },
  { href: "/college/analytics", label: "Analytics", icon: "analytics", group: "Insight & control" },
  { href: "/college/audit-logs", label: "Audit logs", icon: "audit", group: "Insight & control" },
  { href: "/college/settings", label: "Settings", icon: "settings", group: "Insight & control" },
];

export default async function CollegeLayout({ children }: { children: ReactNode }) {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const college = user.collegeId
    ? await prisma.college.findUnique({
        where: { id: user.collegeId },
        select: { name: true, shortName: true },
      })
    : null;

  return (
    <DashboardShell
      roleLabel="College administrator"
      userName={user.name}
      userEmail={user.email}
      collegeName={college?.shortName ?? college?.name ?? "Your college"}
      navItems={navItems}
      tone="ink"
    >
      {children}
    </DashboardShell>
  );
}

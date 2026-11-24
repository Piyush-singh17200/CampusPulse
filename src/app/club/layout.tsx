import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import { prisma } from "@/server/db/client";
import { requireDashboardRole } from "@/server/auth/page-guard";

export const metadata: Metadata = {
  title: "Club dashboard",
  robots: { index: false, follow: false },
};

const navItems: DashboardNavItem[] = [
  { href: "/club", label: "Overview", icon: "overview", exact: true, group: "Operations" },
  { href: "/club/events", label: "Events", icon: "events", group: "Operations" },
  { href: "/club/events/create", label: "Create event", icon: "create", group: "Operations" },
  { href: "/club/registrations", label: "Registrations", icon: "ticket", group: "Operations" },
  { href: "/club/attendance", label: "Attendance", icon: "attendance", group: "Operations" },
  { href: "/club/feedback", label: "Feedback", icon: "feedback", group: "Insights & admin" },
  { href: "/club/analytics", label: "Analytics", icon: "analytics", group: "Insights & admin" },
  { href: "/club/settings", label: "Club settings", icon: "settings", group: "Insights & admin" },
];

export default async function ClubLayout({ children }: { children: ReactNode }) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const college = user.collegeId
    ? await prisma.college.findUnique({
        where: { id: user.collegeId },
        select: { name: true, shortName: true },
      })
    : null;

  return (
    <DashboardShell
      roleLabel="Club administrator"
      userName={user.name}
      userEmail={user.email}
      collegeName={college?.shortName ?? college?.name ?? "Your campus"}
      navItems={navItems}
      tone="signal"
    >
      {children}
    </DashboardShell>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import { prisma } from "@/server/db/client";
import { requireDashboardRole } from "@/server/auth/page-guard";

export const metadata: Metadata = {
  title: "Student dashboard",
  robots: { index: false, follow: false },
};

const navItems: DashboardNavItem[] = [
  { href: "/student", label: "Overview", icon: "overview", exact: true },
  { href: "/student/discover", label: "Discover events", icon: "discover" },
  { href: "/student/registrations", label: "My events", icon: "ticket" },
  { href: "/student/saved", label: "Saved", icon: "saved" },
  { href: "/student/calendar", label: "Calendar", icon: "calendar" },
  { href: "/student/notifications", label: "Notifications", icon: "bell" },
  { href: "/student/profile", label: "Profile", icon: "profile" },
];

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const user = await requireDashboardRole("STUDENT");
  const college = user.collegeId
    ? await prisma.college.findUnique({
        where: { id: user.collegeId },
        select: { name: true, shortName: true },
      })
    : null;

  return (
    <DashboardShell
      roleLabel="Student"
      userName={user.name}
      userEmail={user.email}
      collegeName={college?.shortName ?? college?.name ?? "Your campus"}
      navItems={navItems}
      tone="forest"
    >
      {children}
    </DashboardShell>
  );
}

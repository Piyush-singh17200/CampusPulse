import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import { requireDashboardRole } from "@/server/auth/page-guard";

export const metadata: Metadata = {
  title: "Platform administration",
  robots: { index: false, follow: false },
};

const navItems: DashboardNavItem[] = [
  { href: "/platform", label: "Overview", icon: "platform", exact: true },
  { href: "/platform/colleges", label: "Colleges", icon: "college" },
  { href: "/platform/users", label: "Users", icon: "users" },
  { href: "/platform/analytics", label: "Analytics", icon: "analytics" },
  { href: "/platform/audit-logs", label: "Audit history", icon: "audit" },
  { href: "/platform/settings", label: "Settings", icon: "settings" },
];

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await requireDashboardRole("SUPER_ADMIN");

  return (
    <DashboardShell
      roleLabel="Platform administrator"
      userName={user.name}
      userEmail={user.email}
      collegeName="All colleges"
      navItems={navItems}
      tone="ink"
    >
      {children}
    </DashboardShell>
  );
}

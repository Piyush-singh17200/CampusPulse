import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import { requireDashboardRole } from "@/server/auth/page-guard";

export const metadata: Metadata = {
  title: "Platform administration",
  robots: { index: false, follow: false },
};

const navItems: DashboardNavItem[] = [
  { href: "/platform", label: "Overview", icon: "platform", exact: true, group: "Network" },
  { href: "/platform/colleges", label: "Colleges", icon: "college", group: "Network" },
  { href: "/platform/users", label: "Users", icon: "users", group: "Network" },
  { href: "/platform/analytics", label: "Analytics", icon: "analytics", group: "Network" },
  { href: "/platform/audit-logs", label: "Audit history", icon: "audit", group: "Governance" },
  { href: "/platform/settings", label: "Settings", icon: "settings", group: "Governance" },
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

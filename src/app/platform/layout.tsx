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
      {!user.emailVerified ? (
        <div
          role="status"
          className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block size-2 rounded-full bg-amber-500 animate-pulse"
              aria-hidden="true"
            />
            <span>
              <strong>Super Admin Security Advisory:</strong> Account email (
              <span className="font-mono">{user.email}</span>) is unverified. While SMTP is
              unconfigured (
              <code className="rounded bg-amber-500/20 px-1 py-0.5 font-mono">
                EMAIL_ENABLED=false
              </code>
              ), platform access is preserved in safe local mode. Connecting an SMTP provider will
              enforce verified email for high-privilege operations.
            </span>
          </div>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Unverified Email
          </span>
        </div>
      ) : null}
      {children}
    </DashboardShell>
  );
}

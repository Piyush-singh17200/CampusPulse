import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  ScrollText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  BarList,
  DashboardPageHeader,
  MetricCard,
  SectionCard,
} from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { formatDateTime, titleCase } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getPlatformDashboard } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Platform overview",
  robots: { index: false, follow: false },
};

export default async function PlatformOverviewPage() {
  const user = await requireDashboardRole("SUPER_ADMIN");
  const data = await getPlatformDashboard(user);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Platform administration"
        title="The whole network, at a glance."
        description="Monitor colleges, users, clubs, and events across CampusPulse. Tenant-scoped administrators remain responsible for day-to-day college operations."
        actions={
          <>
            <Link href="/platform/colleges" className={buttonStyles()}>
              Manage colleges
            </Link>
            <Link href="/platform/audit-logs" className={buttonStyles({ variant: "outline" })}>
              Audit history
            </Link>
          </>
        }
      />

      <section className="grid gap-px overflow-hidden rounded-xl border border-line bg-line shadow-card sm:grid-cols-3">
        {[
          {
            label: "Tenant coverage",
            value: `${data.collegeCounts.active}/${data.collegeCounts.total}`,
            detail: "active colleges",
            href: "/platform/colleges",
            icon: Building2,
          },
          {
            label: "Content pipeline",
            value: String(data.clubCounts.pending + data.eventCounts.pending),
            detail: "items awaiting college review",
            href: "/platform/colleges",
            icon: ClipboardCheck,
          },
          {
            label: "Governance trail",
            value: String(data.recentAudit.length),
            detail: "recent actions recorded",
            href: "/platform/audit-logs",
            icon: ScrollText,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="group bg-paper p-4 transition-colors hover:bg-canvas/55 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
                  {item.label}
                </p>
                <Icon
                  aria-hidden="true"
                  className="size-4 text-forest transition-colors group-hover:text-signal-dark"
                />
              </div>
              <p className="mt-2 text-2xl font-bold leading-none tracking-[-0.04em] text-ink">
                {item.value}
              </p>
              <p className="mt-1.5 text-[11px] text-muted">{item.detail}</p>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Colleges"
          value={data.collegeCounts.total}
          detail={`${data.collegeCounts.active} active`}
          tone="forest"
          icon={<Building2 className="size-3.5" />}
        />
        <MetricCard
          label="Users"
          value={data.userCounts.total}
          detail={`${data.userCounts.active} active`}
          icon={<UsersRound className="size-3.5" />}
        />
        <MetricCard
          label="Clubs"
          value={data.clubCounts.total}
          detail={`${data.clubCounts.pending} pending`}
          tone="signal"
          icon={<ShieldCheck className="size-3.5" />}
        />
        <MetricCard
          label="Registrations"
          value={data.registrationCount}
          detail="Platform-wide activity"
          tone="ink"
          icon={<CalendarDays className="size-3.5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-6">
          <SectionCard
            title="Colleges"
            description="The newest colleges on the platform."
            action={
              <Link
                href="/platform/colleges"
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                View all
              </Link>
            }
            bodyClassName="p-0 sm:p-0"
          >
            <ul className="divide-y divide-line">
              {data.recentColleges.map((college) => (
                <li
                  key={college.id}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/platform/colleges/${college.id}`}
                      className="text-[13px] font-bold text-ink hover:text-forest"
                    >
                      {college.name}
                    </Link>
                    <p className="mt-1 text-[11px] text-muted">
                      {college._count.users} users · {college._count.clubs} clubs ·{" "}
                      {college._count.events} events
                    </p>
                  </div>
                  <StatusBadge status={college.status} />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Recent platform audit activity"
            description="Actions across every college."
            bodyClassName="p-0 sm:p-0"
          >
            {data.recentAudit.length ? (
              <ul className="divide-y divide-line">
                {data.recentAudit.map((log) => (
                  <li key={log.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-ink">{titleCase(log.action)}</p>
                      {log.college ? (
                        <span className="text-[11px] text-muted">{log.college.name}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {log.actor.name} · {formatDateTime(log.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-muted">No platform audit activity yet.</p>
            )}
          </SectionCard>
        </div>

        <aside className="space-y-6">
          <SectionCard title="College status" description="Tenant lifecycle distribution.">
            <BarList
              title="Colleges by status"
              items={Object.entries(data.collegeCounts)
                .filter(([key]) => key !== "total")
                .map(([key, value]) => ({ label: titleCase(key), value }))}
              emptyLabel="No colleges yet."
            />
          </SectionCard>
          <SectionCard title="User status" description="Account lifecycle across the platform.">
            <BarList
              title="Users by status"
              items={Object.entries(data.userCounts)
                .filter(([key]) => key !== "total")
                .map(([key, value]) => ({ label: titleCase(key), value }))}
              emptyLabel="No users yet."
            />
          </SectionCard>
          <SectionCard title="Event status" description="All event records.">
            <BarList
              title="Events by status"
              items={Object.entries(data.eventCounts)
                .filter(([key]) => key !== "total")
                .map(([key, value]) => ({ label: titleCase(key), value }))}
              emptyLabel="No events yet."
            />
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

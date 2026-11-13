import type { Metadata } from "next";
import Link from "next/link";

import {
  BarList,
  DashboardPageHeader,
  MetricCard,
  SectionCard,
} from "@/components/dashboard/primitives";
import { buttonStyles } from "@/components/ui/button";
import { formatMonth, titleCase } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getPlatformAnalytics } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Platform analytics",
  robots: { index: false, follow: false },
};

export default async function PlatformAnalyticsPage() {
  const user = await requireDashboardRole("SUPER_ADMIN");
  const data = await getPlatformAnalytics(user);

  const totalUsers = data.userRoleCounts.reduce((sum, item) => sum + item.count, 0);
  const totalEvents = data.eventStatusCounts.reduce((sum, item) => sum + item.count, 0);
  const activeColleges =
    data.collegeStatusCounts.find((item) => item.status === "ACTIVE")?.count ?? 0;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Analytics"
        title="Network-level activity, without estimates."
        description="Every metric is derived from PostgreSQL. Platform analytics are descriptive only; they do not rank students or make automated decisions."
        actions={
          <Link href="/platform/colleges" className={buttonStyles({ variant: "outline" })}>
            College directory
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Colleges" value={activeColleges} detail="Active tenants" tone="forest" />
        <MetricCard label="Users" value={totalUsers} detail="All accounts" />
        <MetricCard label="Events" value={totalEvents} detail="All event records" tone="signal" />
        <MetricCard
          label="Top colleges"
          value={data.collegeBreakdown.length}
          detail="In event activity view"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="College status" description="Tenant lifecycle across the platform.">
          <BarList
            title="Colleges by status"
            items={data.collegeStatusCounts.map((item) => ({
              label: titleCase(item.status),
              value: item.count,
            }))}
            emptyLabel="No colleges yet."
          />
        </SectionCard>
        <SectionCard title="Users by role" description="Account roles across the platform.">
          <BarList
            title="User roles"
            items={data.userRoleCounts.map((item) => ({
              label: titleCase(item.role),
              value: item.count,
            }))}
            emptyLabel="No users yet."
          />
        </SectionCard>
        <SectionCard title="Users by status" description="Account lifecycle across the platform.">
          <BarList
            title="User status"
            items={data.userStatusCounts.map((item) => ({
              label: titleCase(item.status),
              value: item.count,
            }))}
            emptyLabel="No users yet."
          />
        </SectionCard>
        <SectionCard title="Events by status" description="Event lifecycle across all colleges.">
          <BarList
            title="Event status"
            items={data.eventStatusCounts.map((item) => ({
              label: titleCase(item.status),
              value: item.count,
            }))}
            emptyLabel="No events yet."
          />
        </SectionCard>
        <SectionCard
          title="New users by month"
          description="Account creation over the last six months."
        >
          <BarList
            title="New users"
            items={data.userMonths.map((item) => ({
              label: formatMonth(item.month),
              value: item.count,
            }))}
            emptyLabel="No new users in this window."
          />
        </SectionCard>
        <SectionCard
          title="Events by month"
          description="Event start dates over the last six months."
        >
          <BarList
            title="Monthly events"
            items={data.eventMonths.map((item) => ({
              label: formatMonth(item.month),
              value: item.count,
            }))}
            emptyLabel="No events in this window."
          />
        </SectionCard>
      </div>

      <SectionCard
        title="College activity"
        description="The ten colleges with the most event records."
      >
        <BarList
          title="Events by college"
          items={data.collegeBreakdown.map((item) => ({
            label: item.name,
            value: item.events,
            detail: `${item.users} user${item.users === 1 ? "" : "s"}`,
          }))}
          emptyLabel="No college activity yet."
        />
      </SectionCard>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import {
  BarList,
  DashboardPageHeader,
  MetricCard,
  SectionCard,
} from "@/components/dashboard/primitives";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { AnalyticsFilterForm } from "@/features/dashboards/components/analytics-filter-form";
import { analyticsQueryFromParams, analyticsQueryString } from "@/lib/analytics-query";
import { formatMonth } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getPlatformEngagementAnalytics } from "@/server/dashboards/engagement-analytics";

export const metadata: Metadata = {
  title: "Platform analytics",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function percent(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function rating(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export default async function PlatformAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("SUPER_ADMIN");
  const params = await searchParams;
  const data = await getPlatformEngagementAnalytics(user, analyticsQueryFromParams(params));
  const exportHref = `/api/exports/platform/analytics${analyticsQueryString(data.filters)}`;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Analytics"
        title="Network-level activity, without estimates."
        description="Authorized aggregate metrics derived from PostgreSQL. Platform analytics are descriptive only; they do not rank students or make automated decisions."
        actions={
          <>
            <a href={exportHref} className={buttonStyles({ variant: "outline" })}>
              Export CSV
            </a>
            <Link href="/platform/colleges" className={buttonStyles({ variant: "outline" })}>
              College directory
            </Link>
          </>
        }
      />

      <AnalyticsFilterForm
        action="/platform/analytics"
        filters={data.filters}
        showEvent={false}
        showCategory={false}
        showStatus
        resetHref="/platform/analytics"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active colleges"
          value={data.activeColleges}
          detail="Active tenants"
          tone="forest"
        />
        <MetricCard label="Active users" value={data.activeUsers} detail="Active accounts" />
        <MetricCard
          label="Events"
          value={data.totalEvents}
          detail="In the selected range"
          tone="signal"
        />
        <MetricCard
          label="Published events"
          value={data.publishedEvents}
          detail="Approved and visible"
        />
        <MetricCard
          label="Completed events"
          value={data.completedEvents}
          detail="Completed lifecycle"
        />
        <MetricCard
          label="Registrations"
          value={data.totalRegistrations}
          detail="All statuses"
          tone="signal"
        />
        <MetricCard
          label="Attendance"
          value={data.attendedRegistrations}
          detail={`${data.attendedRegistrations} of ${data.eligibleRegistrations} eligible`}
          tone="forest"
        />
        <MetricCard
          label="Attendance rate"
          value={percent(data.attendanceRate)}
          detail="Checked-in / eligible registrations"
          tone="ink"
        />
        <MetricCard
          label="Completion rate"
          value={percent(data.eventCompletionRate)}
          detail="Completed / published + completed"
        />
        <MetricCard
          label="Average rating"
          value={rating(data.averageRating)}
          detail="Visible feedback only"
          tone="forest"
        />
        <MetricCard
          label="Feedback responses"
          value={data.feedbackResponseCount}
          detail="Visible ratings in range"
        />
        <MetricCard
          label="College activity"
          value={data.collegeActivity.length}
          detail="Colleges with events"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Event activity trend"
          description="Events by start month in the selected range."
        >
          <BarList
            title="Events by month"
            items={data.eventMonths.map((item) => ({
              label: formatMonth(item.month),
              value: item.count,
            }))}
            emptyLabel="No events in this window."
          />
          {data.eventTrendsTruncated ? (
            <p className="mt-3 text-[11px] leading-5 text-muted">
              Showing the first 5,000 matching events. Narrow the date range for a complete chart.
            </p>
          ) : null}
        </SectionCard>
        <SectionCard
          title="Registration trend"
          description="Registrations by month in the selected range."
        >
          <BarList
            title="Registrations by month"
            items={data.registrationMonths.map((item) => ({
              label: formatMonth(item.month),
              value: item.count,
            }))}
            emptyLabel="No registrations in this window."
          />
          {data.registrationTrendsTruncated ? (
            <p className="mt-3 text-[11px] leading-5 text-muted">
              Showing the first 5,000 matching registrations. Narrow the date range for a complete
              chart.
            </p>
          ) : null}
        </SectionCard>
        <SectionCard
          title="Attendance trend"
          description="Checked-in registrations by month in the selected range."
        >
          <BarList
            title="Attendance by month"
            items={data.attendanceMonths.map((item) => ({
              label: formatMonth(item.month),
              value: item.count,
            }))}
            emptyLabel="No attendance in this window."
          />
          {data.registrationTrendsTruncated ? (
            <p className="mt-3 text-[11px] leading-5 text-muted">
              Showing the first 5,000 matching registrations. Narrow the date range for a complete
              chart.
            </p>
          ) : null}
        </SectionCard>
        <SectionCard title="Event status" description="Lifecycle distribution across the platform.">
          <BarList
            title="Event status"
            items={data.eventStatusCounts.map((item) => ({
              label: item.status
                .toLowerCase()
                .split("_")
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(" "),
              value: item.count,
            }))}
            emptyLabel="No events in this window."
          />
        </SectionCard>
      </div>

      <SectionCard
        title="College activity"
        description="Authorized aggregate event counts by college. Student-level records are not exposed."
        bodyClassName="p-0 sm:p-0"
      >
        {data.collegeActivity.length ? (
          <ul className="divide-y divide-line">
            {data.collegeActivity.map((college) => (
              <li key={college.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <p className="text-[13px] font-semibold text-ink">{college.name}</p>
                <p className="text-sm font-bold text-ink">
                  {college.count} event{college.count === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No college activity in this window"
              description="Try a wider date range or reset the filters."
            />
          </div>
        )}
        {data.collegeActivityTruncated ? (
          <p className="border-t border-line px-5 py-3 text-[11px] leading-5 text-muted">
            Based on the first 5,000 matching events. Narrow the date range for complete college
            counts.
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}

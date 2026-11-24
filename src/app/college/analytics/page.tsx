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
import { EmptyState } from "@/components/ui/states";
import { AnalyticsFilterForm } from "@/features/dashboards/components/analytics-filter-form";
import { analyticsQueryFromParams, analyticsQueryString } from "@/lib/analytics-query";
import { formatDateTime, formatMonth } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getCollegeEngagementAnalytics } from "@/server/dashboards/engagement-analytics";

export const metadata: Metadata = {
  title: "College analytics",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function percent(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function rating(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export default async function CollegeAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const params = await searchParams;
  const data = await getCollegeEngagementAnalytics(user, analyticsQueryFromParams(params));
  const exportHref = `/api/exports/college/analytics${analyticsQueryString(data.filters)}`;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Analytics"
        title="A factual view of campus activity."
        description="Every number is derived from PostgreSQL records for your college. Attendance uses checked-in registrations divided by eligible registrations."
        actions={
          <>
            <a href={exportHref} className={buttonStyles({ variant: "outline" })}>
              Export CSV
            </a>
            <Link href="/college/events" className={buttonStyles({ variant: "outline" })}>
              Event register
            </Link>
          </>
        }
      />

      <AnalyticsFilterForm
        action="/college/analytics"
        filters={data.filters}
        clubs={data.clubs}
        categories={data.categories}
        events={data.eventOptions}
        showClub
        resetHref="/college/analytics"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Events" value={data.totalEvents} detail="In the selected range" />
        <MetricCard
          label="Published"
          value={data.publishedEvents}
          detail="Approved and visible"
          tone="forest"
        />
        <MetricCard
          label="Pending approvals"
          value={data.pendingApprovals}
          detail="Awaiting review"
        />
        <MetricCard
          label="Registrations"
          value={data.totalRegistrations}
          detail="All statuses"
          tone="signal"
        />
        <MetricCard
          label="Active registrations"
          value={data.activeRegistrations}
          detail="Confirmed and attended"
        />
        <MetricCard
          label="Cancelled"
          value={data.cancelledRegistrations}
          detail="Released places"
        />
        <MetricCard
          label="Present"
          value={data.attendedRegistrations}
          detail="Checked-in registrations"
          tone="forest"
        />
        <MetricCard
          label="Attendance rate"
          value={percent(data.attendanceRate)}
          detail={`${data.attendedRegistrations} of ${data.eligibleRegistrations} eligible`}
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
          label="No-show"
          value={data.noShowRegistrations}
          detail="Eligible but not checked in"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Event trend" description="Events by start month in the selected range.">
          <BarList
            title="Events by month"
            items={data.eventMonths.map((item) => ({
              label: formatMonth(item.month),
              value: item.count,
            }))}
            emptyLabel="No events in this window."
          />
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
        </SectionCard>
        <SectionCard title="Category mix" description="Events assigned to each category.">
          <BarList
            title="Categories"
            items={data.categoryBreakdown.map((item) => ({ label: item.name, value: item.count }))}
            emptyLabel="No categories assigned in this window."
          />
        </SectionCard>
        <SectionCard title="Club activity" description="Events by club in the selected range.">
          <BarList
            title="Events by club"
            items={data.clubActivity.map((item) => ({ label: item.name, value: item.count }))}
            emptyLabel="No club activity in this window."
          />
        </SectionCard>
        <SectionCard title="Feedback distribution" description="Visible ratings from 1 to 5.">
          <BarList
            title="Feedback ratings"
            valueLabel="Responses"
            items={[5, 4, 3, 2, 1].map((value) => ({
              label: `${value} star${value === 1 ? "" : "s"}`,
              value: data.feedbackDistribution.find((item) => item.rating === value)?.count ?? 0,
            }))}
            emptyLabel="No feedback in this window."
          />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Most-attended events"
          description="Ranked by checked-in registrations."
          bodyClassName="p-0 sm:p-0"
        >
          {data.mostAttendedEvents.length ? (
            <ul className="divide-y divide-line">
              {data.mostAttendedEvents.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">{event.title}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {event.clubName} · {formatDateTime(event.startsAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-ink">
                    {percent(event.attendanceRate)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-xs text-muted">No attendance data yet.</p>
          )}
        </SectionCard>
        <SectionCard
          title="Low-attendance events"
          description="Events below 50% attendance with eligible registrations."
          bodyClassName="p-0 sm:p-0"
        >
          {data.lowAttendanceEvents.length ? (
            <ul className="divide-y divide-line">
              {data.lowAttendanceEvents.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">{event.title}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {event.attended} of {event.eligible} eligible
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-signal-dark">
                    {percent(event.attendanceRate)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-xs text-muted">No low-attendance events in this window.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Event breakdown"
        description="Registration, attendance, and feedback metrics for each event in the selected range."
        bodyClassName="p-0 sm:p-0"
      >
        {data.eventBreakdown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.13em] text-muted">
                  <th scope="col" className="px-4 py-3 font-bold">
                    Event
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Club
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">
                    Registered
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">
                    Attended
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">
                    Attendance
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.eventBreakdown.map((event) => (
                  <tr key={event.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-ink">{event.title}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {formatDateTime(event.startsAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-ink-soft">{event.clubName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-ink-soft">
                      {event.totalRegistrations}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-ink-soft">
                      {event.attended}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] font-semibold text-ink">
                      {percent(event.attendanceRate)}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-ink-soft">
                      {rating(event.averageRating)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No events match these filters"
              description="Try a wider date range or reset the filters."
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

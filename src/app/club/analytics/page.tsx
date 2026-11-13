import type { Metadata } from "next";
import Link from "next/link";

import { ClubSwitcher } from "@/components/dashboard/club-switcher";
import {
  BarList,
  DashboardPageHeader,
  MetricCard,
  SectionCard,
} from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime, titleCase } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getClubAnalytics } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Club analytics",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClubAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const params = await searchParams;
  const clubId = typeof params.club === "string" ? params.club : undefined;
  const data = await getClubAnalytics(user, clubId);

  if (!data.club) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader eyebrow="Analytics" title="No managed club found." />
        <EmptyState
          title="Club access required"
          description="Ask your college administrator to assign an active club manager membership."
        />
      </div>
    );
  }

  const totalEvents = data.eventCounts.reduce((sum, item) => sum + item.count, 0);
  const published = data.eventCounts.find((item) => item.status === "PUBLISHED")?.count ?? 0;
  const upcoming = data.eventBreakdown.filter(
    (item) => item.startsAt >= new Date() && item.status === "PUBLISHED",
  ).length;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Analytics"
        title="How your club is moving."
        description="Database-derived event and registration totals. No estimated or decorative numbers."
        actions={
          <Link
            href={`/club/events?club=${data.club.id}`}
            className={buttonStyles({ variant: "outline" })}
          >
            Manage events
          </Link>
        }
      >
        <ClubSwitcher clubs={data.clubs} activeClubId={data.club.id} path="/club/analytics" />
      </DashboardPageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Events" value={totalEvents} detail="All-time club events" />
        <MetricCard
          label="Published"
          value={published}
          detail="Approved and visible"
          tone="forest"
        />
        <MetricCard label="Upcoming" value={upcoming} detail="Published, future start" />
        <MetricCard
          label="Registrations"
          value={data.totalRegistrations}
          detail="Across all events"
          tone="signal"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Events by status" description="The current lifecycle distribution.">
          <BarList
            title="Event status"
            items={data.eventCounts.map((item) => ({
              label: titleCase(item.status),
              value: item.count,
            }))}
            emptyLabel="No events yet."
          />
        </SectionCard>
        <SectionCard
          title="Registrations by status"
          description="Places, cancellations, and attendance."
        >
          <BarList
            title="Registration status"
            items={data.registrationCounts.map((item) => ({
              label: titleCase(item.status),
              value: item.count,
            }))}
            emptyLabel="No registrations yet."
          />
        </SectionCard>
        <SectionCard title="Category mix" description="How many club events use each category.">
          <BarList
            title="Categories"
            items={data.categoryBreakdown.map((item) => ({ label: item.name, value: item.count }))}
            emptyLabel="No categories assigned yet."
          />
        </SectionCard>
        <SectionCard
          title="Event-wise registrations"
          description="The latest events and their total registration counts."
          bodyClassName="p-0 sm:p-0"
        >
          {data.eventBreakdown.length ? (
            <ul className="divide-y divide-line">
              {data.eventBreakdown.slice(0, 10).map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <Link
                      href={`/club/events/${event.id}?club=${data.club?.id}`}
                      className="block truncate text-[13px] font-semibold text-ink hover:text-forest"
                    >
                      {event.title}
                    </Link>
                    <p className="mt-1 text-[11px] text-muted">{formatDateTime(event.startsAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={event.status} />
                    <span className="text-sm font-bold text-ink">{event.count}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-xs text-muted">No events to analyze yet.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

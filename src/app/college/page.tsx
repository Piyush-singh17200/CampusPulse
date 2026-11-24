import { ArrowUpRight, Building2, CalendarCheck2, ClipboardCheck, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DashboardEventCard } from "@/components/dashboard/event-card";
import {
  BarList,
  DashboardPageHeader,
  MetricCard,
  SectionCard,
} from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime, titleCase } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getCollegeDashboard } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "College overview",
  robots: { index: false, follow: false },
};

export default async function CollegeOverviewPage() {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const data = await getCollegeDashboard(user);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="College administration"
        title={data.college.name}
        description="Moderate events and clubs, manage people, and keep a clear audit trail for your college."
        actions={
          <>
            <Link href="/college/approvals" className={buttonStyles()}>
              Open approvals
            </Link>
            <Link href="/college/users" className={buttonStyles({ variant: "outline" })}>
              Manage users
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={data.college.status} />
          <span className="text-xs text-muted">Timezone {data.college.timezone}</span>
          <Badge variant={data.pendingEvents.length ? "signal" : "forest"}>
            {data.pendingEvents.length
              ? `${data.pendingEvents.length} event${data.pendingEvents.length === 1 ? "" : "s"} awaiting review`
              : "Approval queue clear"}
          </Badge>
        </div>
      </DashboardPageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="relative overflow-hidden rounded-xl border border-ink bg-ink p-5 text-paper shadow-card sm:p-6">
          <div className="section-grid-dark pointer-events-none absolute inset-0 opacity-25" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-signal">
                  Approval queue
                </p>
                <p className="mt-2 font-display text-4xl leading-none tracking-[-0.03em]">
                  {data.pendingEvents.length}
                </p>
                <p className="mt-1 text-[11px] text-paper/55">
                  event submission{data.pendingEvents.length === 1 ? "" : "s"} waiting
                </p>
              </div>
              <ClipboardCheck aria-hidden="true" className="size-5 text-signal" />
            </div>
            {data.pendingEvents[0] ? (
              <div className="mt-4 border-t border-paper/15 pt-3">
                <p className="truncate text-[12px] font-semibold">{data.pendingEvents[0].title}</p>
                <p className="mt-1 truncate text-[10px] text-paper/50">
                  {data.pendingEvents[0].club.name} ·{" "}
                  {formatDateTime(data.pendingEvents[0].startsAt)}
                </p>
              </div>
            ) : (
              <p className="mt-4 border-t border-paper/15 pt-3 text-[11px] leading-5 text-paper/50">
                No event submissions are waiting. The published calendar is current.
              </p>
            )}
            <Link
              href="/college/approvals"
              className={buttonStyles({
                variant: "inverse",
                size: "sm",
                className: "mt-4 border-paper/25 hover:bg-paper/10",
              })}
            >
              Open approval queue
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-paper p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                Club applications
              </p>
              <p className="mt-2 font-display text-4xl leading-none tracking-[-0.03em] text-ink">
                {data.pendingClubs.length}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                new club{data.pendingClubs.length === 1 ? "" : "s"} to review
              </p>
            </div>
            <Building2 aria-hidden="true" className="size-5 text-forest" />
          </div>
          {data.pendingClubs[0] ? (
            <div className="mt-4 border-t border-line pt-3">
              <p className="truncate text-[12px] font-semibold text-ink">
                {data.pendingClubs[0].name}
              </p>
              <p className="mt-1 truncate text-[10px] text-muted">
                Submitted by {data.pendingClubs[0].createdBy.name}
              </p>
            </div>
          ) : (
            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-5 text-muted">
              No club applications are waiting. New requests will appear here.
            </p>
          )}
          <Link
            href="/college/clubs"
            className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4" })}
          >
            Review clubs
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Clubs"
          value={data.clubCounts.total}
          detail={`${data.clubCounts.active} active`}
          tone="forest"
          icon={<Building2 className="size-3.5" />}
        />
        <MetricCard
          label="Pending clubs"
          value={data.clubCounts.pending}
          detail="Awaiting a decision"
          tone="signal"
          icon={<ClipboardCheck className="size-3.5" />}
        />
        <MetricCard
          label="Events"
          value={data.eventCounts.total}
          detail={`${data.eventCounts.published} published`}
          icon={<CalendarCheck2 className="size-3.5" />}
        />
        <MetricCard
          label="Registrations"
          value={data.registrationCount}
          detail="College-wide activity"
          tone="ink"
          icon={<UsersRound className="size-3.5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-6">
          <SectionCard
            title="Pending event approvals"
            description="Submitted by clubs and waiting for college review."
            action={
              <Link
                href="/college/approvals"
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                Review all
              </Link>
            }
            bodyClassName="p-0 sm:p-0"
          >
            {data.pendingEvents.length ? (
              <ul className="divide-y divide-line">
                {data.pendingEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/college/events/${event.id}`}
                        className="text-[13px] font-bold text-ink hover:text-forest"
                      >
                        {event.title}
                      </Link>
                      <p className="mt-1 text-[11px] text-muted">
                        {event.club.name} · {formatDateTime(event.startsAt)}
                      </p>
                    </div>
                    <StatusBadge status={event.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-muted">No event approvals are waiting.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Upcoming published events"
            description="Visible to students across your college."
            action={
              <Link
                href="/college/events"
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                View events
              </Link>
            }
            bodyClassName="p-4 sm:p-5"
          >
            {data.upcomingEvents.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {data.upcomingEvents.map((event) => (
                  <DashboardEventCard
                    key={event.id}
                    event={event}
                    href={`/college/events/${event.id}`}
                    compact
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No upcoming events"
                description="Published events from active clubs will appear here."
              />
            )}
          </SectionCard>
        </div>

        <aside className="space-y-6">
          <SectionCard
            title="Pending clubs"
            description="New club applications."
            bodyClassName="p-0 sm:p-0"
          >
            {data.pendingClubs.length ? (
              <ul className="divide-y divide-line">
                {data.pendingClubs.map((club) => (
                  <li key={club.id} className="px-5 py-4">
                    <p className="text-[13px] font-bold text-ink">{club.name}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      Submitted by {club.createdBy.name}
                    </p>
                    <Link
                      href={`/college/clubs/${club.id}`}
                      className={buttonStyles({
                        variant: "ghost",
                        size: "sm",
                        className: "mt-2 px-0",
                      })}
                    >
                      Review club
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-muted">No club applications are waiting.</p>
            )}
          </SectionCard>

          <SectionCard title="Event status" description="Current lifecycle distribution.">
            <BarList
              title="Events by status"
              items={Object.entries(data.eventCounts)
                .filter(([key]) => key !== "total")
                .map(([key, value]) => ({ label: titleCase(key), value }))}
              emptyLabel="No events yet."
            />
          </SectionCard>

          <SectionCard
            title="Recent audit activity"
            description="Administrative actions in your college."
            bodyClassName="p-0 sm:p-0"
          >
            {data.recentAudit.length ? (
              <ul className="divide-y divide-line">
                {data.recentAudit.map((log) => (
                  <li key={log.id} className="px-5 py-3.5">
                    <p className="text-[12px] font-semibold text-ink">{titleCase(log.action)}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {log.actor.name} · {formatDateTime(log.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-muted">No audit activity yet.</p>
            )}
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

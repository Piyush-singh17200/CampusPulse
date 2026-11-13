import type { Metadata } from "next";
import Link from "next/link";

import { ClubSwitcher } from "@/components/dashboard/club-switcher";
import { DashboardEventCard } from "@/components/dashboard/event-card";
import { DashboardPageHeader, MetricCard, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getClubDashboard } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Club overview",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClubOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const params = await searchParams;
  const clubId = typeof params.club === "string" ? params.club : undefined;
  const data = await getClubDashboard(user, clubId);

  if (!data.club) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader
          eyebrow="Club workspace"
          title="No managed club found."
          description="Your account has no active president or officer membership in a club."
        />
        <EmptyState
          title="Club access required"
          description="Ask your college administrator to assign an active club manager membership."
          action={
            <Link href="/account" className={buttonStyles({ variant: "outline" })}>
              Open account
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Club workspace"
        title={data.club.name}
        description={
          data.club.description ??
          "Manage your club's events, registrations, attendance, and public profile."
        }
        actions={
          <>
            <Link href={`/club/events/create?club=${data.club.id}`} className={buttonStyles()}>
              Create event
            </Link>
            <Link
              href={`/club/events?club=${data.club.id}`}
              className={buttonStyles({ variant: "outline" })}
            >
              Manage events
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={data.club.status} />
          <Badge variant="outline">{data.registrationCount} total registrations</Badge>
          <ClubSwitcher clubs={data.clubs} activeClubId={data.club.id} path="/club" />
        </div>
      </DashboardPageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Upcoming"
          value={data.counts.published}
          detail="Published events"
          tone="forest"
        />
        <MetricCard label="Drafts" value={data.counts.draft} detail="Waiting to submit" />
        <MetricCard
          label="Pending"
          value={data.counts.pending}
          detail="In college review"
          tone="signal"
        />
        <MetricCard label="Completed" value={data.counts.completed} detail="Recorded as finished" />
        <MetricCard
          label="Registrations"
          value={data.registrationCount}
          detail="Across all events"
          tone="ink"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-6">
          <SectionCard
            title="Next events"
            description="Published events ordered by start time."
            action={
              <Link
                href={`/club/events?club=${data.club.id}`}
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                View all
              </Link>
            }
            bodyClassName="p-4 sm:p-5"
          >
            {data.upcoming.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {data.upcoming.map((event) => (
                  <DashboardEventCard
                    key={event.id}
                    event={event}
                    href={`/club/events/${event.id}?club=${data.club.id}`}
                    compact
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No published upcoming events"
                description="Create a draft, then submit it for college approval when the details are ready."
                action={
                  <Link
                    href={`/club/events/create?club=${data.club.id}`}
                    className={buttonStyles({ size: "sm" })}
                  >
                    Create an event
                  </Link>
                }
              />
            )}
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Drafts"
              description="Only drafts and rejected events can be edited."
              bodyClassName="p-0 sm:p-0"
            >
              {data.drafts.length ? (
                <ul className="divide-y divide-line">
                  {data.drafts.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <Link
                        href={`/club/events/${event.id}?club=${data.club.id}`}
                        className="min-w-0 text-[13px] font-semibold leading-5 text-ink hover:text-forest"
                      >
                        <span className="block truncate">{event.title}</span>
                        <span className="mt-1 block text-[11px] font-normal text-muted">
                          Updated {formatDateTime(event.updatedAt)}
                        </span>
                      </Link>
                      <StatusBadge status={event.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-xs text-muted">No drafts are waiting.</p>
              )}
            </SectionCard>

            <SectionCard
              title="Pending approval"
              description="Submitted to college administrators."
              bodyClassName="p-0 sm:p-0"
            >
              {data.pending.length ? (
                <ul className="divide-y divide-line">
                  {data.pending.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <Link
                        href={`/club/events/${event.id}?club=${data.club.id}`}
                        className="min-w-0 text-[13px] font-semibold leading-5 text-ink hover:text-forest"
                      >
                        <span className="block truncate">{event.title}</span>
                        <span className="mt-1 block text-[11px] font-normal text-muted">
                          Starts {formatDateTime(event.startsAt)}
                        </span>
                      </Link>
                      <StatusBadge status={event.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-xs text-muted">Nothing is waiting for review.</p>
              )}
            </SectionCard>
          </div>
        </div>

        <aside className="space-y-6">
          <SectionCard title="Club identity" description="Public profile fields.">
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">Name</dt>
                <dd className="text-right font-semibold text-ink">{data.club.name}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">Status</dt>
                <dd>
                  <StatusBadge status={data.club.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">Approved</dt>
                <dd className="text-right font-semibold text-ink">
                  {data.club.approvedAt ? formatDateTime(data.club.approvedAt) : "Not yet"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Created</dt>
                <dd className="text-right font-semibold text-ink">
                  {formatDateTime(data.club.createdAt)}
                </dd>
              </div>
            </dl>
            <Link
              href={`/club/settings?club=${data.club.id}`}
              className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4" })}
            >
              Edit club profile
            </Link>
          </SectionCard>

          <SectionCard
            title="Recent activity"
            description="Latest event updates from this club."
            bodyClassName="p-0 sm:p-0"
          >
            {data.recent.length ? (
              <ul className="divide-y divide-line">
                {data.recent.map((event) => (
                  <li key={event.id} className="px-5 py-3.5">
                    <Link
                      href={`/club/events/${event.id}?club=${data.club.id}`}
                      className="text-[12px] font-semibold text-ink hover:text-forest"
                    >
                      {event.title}
                    </Link>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                      <StatusBadge status={event.status} />
                      {formatDateTime(event.updatedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-muted">No event activity yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Quick links" description="The work that matters most.">
            <div className="grid gap-2">
              <Link
                href={`/club/registrations?club=${data.club.id}`}
                className={buttonStyles({ variant: "outline", size: "sm" })}
              >
                Registrations
              </Link>
              <Link
                href={`/club/attendance?club=${data.club.id}`}
                className={buttonStyles({ variant: "outline", size: "sm" })}
              >
                Attendance
              </Link>
              <Link
                href={`/club/analytics?club=${data.club.id}`}
                className={buttonStyles({ variant: "outline", size: "sm" })}
              >
                Analytics
              </Link>
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { DashboardEventCard } from "@/components/dashboard/event-card";
import { DashboardPageHeader, MetricCard, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ActionForm } from "@/features/dashboards/components/action-form";
import { saveEventAction, unsaveEventAction } from "@/features/dashboards/actions";
import { formatDate, formatTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getStudentDashboard } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Student overview",
  robots: { index: false, follow: false },
};

export default async function StudentOverviewPage() {
  const user = await requireDashboardRole("STUDENT");
  const data = await getStudentDashboard(user);

  if (!data.profile || !data.college) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader
          eyebrow="Student workspace"
          title={`Welcome, ${user.name.split(" ")[0]}.`}
          description="Your student profile is not ready yet. Ask your college administrator to complete your student record."
        />
        <EmptyState
          title="Student profile not found"
          description="CampusPulse needs a student profile linked to your college before it can show registrations, saved events, and recommendations."
          action={
            <Link href="/account" className={buttonStyles({ variant: "outline" })}>
              Open account
            </Link>
          }
        />
      </div>
    );
  }

  const savedIds = new Set(data.saved.map((event) => event.id));
  const firstName = data.profile.user.name.split(" ")[0] || "there";

  return (
    <div className="space-y-7">
      <DashboardPageHeader
        eyebrow="Student workspace"
        title={`Welcome back, ${firstName}.`}
        description={`Here is what is happening around ${data.college.shortName ?? data.college.name} and what needs your attention next.`}
        actions={
          <>
            <Link href="/student/discover" className={buttonStyles({ variant: "primary" })}>
              Discover events
            </Link>
            <Link href="/student/calendar" className={buttonStyles({ variant: "outline" })}>
              Open calendar
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="forest">{data.college.name}</Badge>
          {data.unreadNotifications > 0 ? (
            <Link href="/student/notifications">
              <Badge variant="signal">{data.unreadNotifications} unread notifications</Badge>
            </Link>
          ) : (
            <Badge variant="muted">All caught up</Badge>
          )}
        </div>
      </DashboardPageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Upcoming"
          value={data.counts.upcoming}
          detail="Confirmed registrations"
          tone="forest"
        />
        <MetricCard
          label="Registered"
          value={data.counts.registered}
          detail="All-time registrations"
        />
        <MetricCard label="Attended" value={data.counts.attended} detail="Events marked attended" />
        <MetricCard
          label="Saved"
          value={data.counts.saved}
          detail="Events on your shortlist"
          tone="signal"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-6">
          <SectionCard
            title="Your next events"
            description="Confirmed registrations, ordered by start time."
            action={
              <Link
                href="/student/registrations"
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                View all
              </Link>
            }
            bodyClassName="p-4 sm:p-5"
          >
            {data.upcoming.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {data.upcoming.map(({ event }) => (
                  <DashboardEventCard
                    key={event.id}
                    event={event}
                    href={`/student/events/${event.id}`}
                    registered
                    compact
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No upcoming registrations"
                description="Find something worth showing up for. Discovery only shows published events from active clubs."
                action={
                  <Link href="/student/discover" className={buttonStyles({ size: "sm" })}>
                    Browse events
                  </Link>
                }
              />
            )}
          </SectionCard>

          <SectionCard
            title={data.recommended.length ? "Picked for you" : "Recently published"}
            description={
              data.recommended.length
                ? "Based on the categories of events you have registered for."
                : "The newest published events from active clubs."
            }
            action={
              <Link
                href="/student/discover"
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                Discover
              </Link>
            }
            bodyClassName="p-4 sm:p-5"
          >
            {(data.recommended.length ? data.recommended : data.recent).length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {(data.recommended.length ? data.recommended : data.recent).map((event) => (
                  <DashboardEventCard
                    key={event.id}
                    event={event}
                    href={`/student/events/${event.id}`}
                    saved={savedIds.has(event.id)}
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/student/events/${event.id}`}
                          className={buttonStyles({ variant: "outline", size: "sm" })}
                        >
                          View
                        </Link>
                        <ActionForm
                          action={savedIds.has(event.id) ? unsaveEventAction : saveEventAction}
                          fields={{ eventId: event.id }}
                          submitLabel={savedIds.has(event.id) ? "Unsave" : "Save"}
                          variant="ghost"
                          size="sm"
                          showMessage={false}
                        />
                      </div>
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No published events yet"
                description="When your college publishes an event, it will appear here."
              />
            )}
          </SectionCard>
        </div>

        <aside className="space-y-6">
          <SectionCard title="Registration snapshot" description="A quick view of your activity.">
            <dl className="space-y-3">
              {[
                ["Upcoming", data.counts.upcoming],
                ["All registrations", data.counts.registered],
                ["Attended", data.counts.attended],
                ["Cancelled", data.counts.cancelled],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
                >
                  <dt className="text-[13px] text-muted">{label}</dt>
                  <dd className="text-sm font-bold text-ink">{Number(value)}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard
            title="Saved for later"
            description="Your private shortlist."
            action={
              <Link
                href="/student/saved"
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                View all
              </Link>
            }
          >
            {data.saved.length ? (
              <ul className="space-y-3">
                {data.saved.map((event) => (
                  <li key={event.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                    <Link
                      href={`/student/events/${event.id}`}
                      className="block text-[13px] font-semibold leading-5 text-ink hover:text-forest"
                    >
                      {event.title}
                    </Link>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatDate(event.startsAt)} · {formatTime(event.startsAt)}
                    </p>
                    <div className="mt-2">
                      <StatusBadge status={event.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-5 text-muted">
                Save events while you browse to keep them here. Saved events are stored in your
                CampusPulse account, not just this browser.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Notifications" description="Registration and approval updates.">
            <p className="text-3xl font-bold tracking-[-0.04em] text-ink">
              {data.unreadNotifications}
            </p>
            <p className="mt-1 text-xs text-muted">
              unread notification{data.unreadNotifications === 1 ? "" : "s"}
            </p>
            <Link
              href="/student/notifications"
              className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4" })}
            >
              Open notifications
            </Link>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

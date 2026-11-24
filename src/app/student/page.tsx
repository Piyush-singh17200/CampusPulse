import {
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Compass,
  MapPin,
  Sparkles,
  Ticket,
} from "lucide-react";
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
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
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
  const nextEvent = data.upcoming[0]?.event ?? null;
  const interestNames = data.profile.interests.slice(0, 4).map((item) => item.interest.name);
  const onRadar = [
    ...data.upcoming.map(({ event }) => event),
    ...data.recommendations.map(({ event }) => event),
  ]
    .filter(
      (event, index, events) =>
        events.findIndex((candidate) => candidate.id === event.id) === index,
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 3);

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
          {interestNames.length ? (
            <span className="text-[11px] text-muted">
              Following {interestNames.slice(0, 2).join(" · ")}
            </span>
          ) : null}
        </div>
      </DashboardPageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <section className="relative overflow-hidden rounded-xl border border-forest bg-forest text-paper shadow-card">
          <div className="section-grid-dark pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-signal">
                <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
                Next registered event
              </p>
              {nextEvent ? <Badge variant="dark">Confirmed</Badge> : null}
            </div>

            {nextEvent ? (
              <div className="mt-5 grid gap-5 sm:grid-cols-[4.5rem_1fr] sm:items-start">
                <div className="flex w-fit flex-col items-center rounded-lg border border-paper/20 bg-paper/10 px-3 py-2.5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-signal">
                    {formatDate(nextEvent.startsAt).split(",")[0]}
                  </span>
                  <span className="mt-1 font-display text-4xl leading-none">
                    {formatDate(nextEvent.startsAt).match(/\d{1,2}/)?.[0] ?? ""}
                  </span>
                  <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-paper/55">
                    {formatTime(nextEvent.startsAt)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-paper/50">
                    {nextEvent.club.name}
                  </p>
                  <h2 className="mt-1.5 max-w-2xl text-balance font-display text-[clamp(1.8rem,3vw,2.7rem)] leading-[0.98] tracking-[-0.02em]">
                    {nextEvent.title}
                  </h2>
                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-paper/60">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden="true" className="size-3.5 text-signal" />
                      {nextEvent.isOnline ? "Online event" : nextEvent.venueName}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Ticket aria-hidden="true" className="size-3.5 text-signal" />
                      Registration confirmed
                    </span>
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/student/events/${nextEvent.id}`}
                      className={buttonStyles({
                        variant: "inverse",
                        size: "sm",
                        className: "border-paper/30 hover:bg-paper/15",
                      })}
                    >
                      View event details
                      <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </Link>
                    <Link
                      href="/student/registrations"
                      className={buttonStyles({
                        variant: "ghost",
                        size: "sm",
                        className: "text-paper/70 hover:bg-paper/10 hover:text-paper",
                      })}
                    >
                      All my events
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 max-w-xl">
                <h2 className="font-display text-3xl leading-none tracking-[-0.02em]">
                  Your calendar is wide open.
                </h2>
                <p className="mt-3 text-sm leading-6 text-paper/60">
                  Browse curated events from active clubs, save a few, and register when something
                  fits your week.
                </p>
                <Link
                  href="/student/discover"
                  className={buttonStyles({
                    variant: "inverse",
                    size: "sm",
                    className: "mt-5 border-paper/30 hover:bg-paper/15",
                  })}
                >
                  <Compass aria-hidden="true" className="size-3.5" />
                  Find something worth showing up for
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-paper p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                On your radar
              </p>
              <h2 className="mt-1.5 text-sm font-bold tracking-[-0.01em] text-ink">
                The next three things
              </h2>
            </div>
            <Link
              href="/student/calendar"
              aria-label="Open calendar"
              className="grid size-8 place-items-center rounded-full border border-line text-ink transition-colors hover:border-forest hover:text-forest"
            >
              <CalendarDays aria-hidden="true" className="size-4" />
            </Link>
          </div>

          {onRadar.length ? (
            <ul className="mt-4 space-y-3">
              {onRadar.map((event) => (
                <li key={event.id}>
                  <Link href={`/student/events/${event.id}`} className="group flex gap-3">
                    <span className="flex w-9 shrink-0 flex-col items-center rounded-md border border-line bg-canvas/50 py-1.5">
                      <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted">
                        {formatDate(event.startsAt).split(",")[0]}
                      </span>
                      <span className="font-display text-lg leading-none text-ink">
                        {formatDate(event.startsAt).match(/\d{1,2}/)?.[0] ?? ""}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 border-b border-line pb-3 group-last:border-0 group-last:pb-0">
                      <span className="block truncate text-[12px] font-semibold text-ink group-hover:text-forest">
                        {event.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-muted">
                        {formatTime(event.startsAt)} · {event.club.name}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-xs leading-5 text-muted">
              Nothing on the radar yet. Discovery is the fastest way to find your first event.
            </p>
          )}

          <Link
            href="/student/discover"
            className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-[11px] font-bold text-forest transition-colors hover:text-ink"
          >
            Browse all events
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Upcoming"
          value={data.counts.upcoming}
          detail="Confirmed registrations"
          tone="forest"
          icon={<CalendarDays className="size-3.5" />}
        />
        <MetricCard
          label="Registered"
          value={data.counts.registered}
          detail="All-time registrations"
          tone="ink"
          icon={<Ticket className="size-3.5" />}
        />
        <MetricCard
          label="Attended"
          value={data.counts.attended}
          detail="Events marked attended"
          icon={<CheckCircle2 className="size-3.5" />}
        />
        <MetricCard
          label="Saved"
          value={data.counts.saved}
          detail="Events on your shortlist"
          tone="signal"
          icon={<Bookmark className="size-3.5" />}
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
            title={data.recommendations.length ? "Picked for you" : "Recently published"}
            description={
              data.recommendations.length
                ? "Based on your interests, event categories, timing, and campus activity."
                : data.recent.length
                  ? "The newest published events from active clubs."
                  : (data.recommendationReason ?? "The newest published events from active clubs.")
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
            {data.recommendations.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {data.recommendations.map(({ event, explanations }) => (
                  <div key={event.id} className="space-y-2">
                    <DashboardEventCard
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
                    {explanations[0] ? (
                      <p className="flex items-start gap-1.5 px-1 text-[11px] leading-5 text-muted">
                        <Sparkles
                          aria-hidden="true"
                          className="mt-0.5 size-3 shrink-0 text-signal-dark"
                        />
                        {explanations[0]}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : data.recent.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {data.recent.map((event) => (
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
          <SectionCard
            title="Your interests"
            description="What shapes your recommendations."
            action={
              <Link
                href="/student/profile"
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                Edit
              </Link>
            }
          >
            {interestNames.length ? (
              <div className="flex flex-wrap gap-1.5">
                {data.profile.interests.map((item) => (
                  <Badge key={item.interest.id} variant="sage">
                    {item.interest.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5 text-muted">
                Add a few interests to make discovery more useful.
              </p>
            )}
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
                  Attended
                </dt>
                <dd className="mt-1 text-lg font-bold text-ink">{data.counts.attended}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
                  Cancelled
                </dt>
                <dd className="mt-1 text-lg font-bold text-ink">{data.counts.cancelled}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard
            title="Latest notifications"
            description={
              data.unreadNotifications
                ? `${data.unreadNotifications} unread update${data.unreadNotifications === 1 ? "" : "s"}`
                : "You are all caught up."
            }
            action={
              <Link
                href="/student/notifications"
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                Open
              </Link>
            }
          >
            {data.latestNotifications.length ? (
              <ul className="space-y-3">
                {data.latestNotifications.map((notification) => (
                  <li
                    key={notification.id}
                    className="border-b border-line pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`size-1.5 shrink-0 rounded-full ${
                          notification.readAt ? "bg-line-strong" : "bg-signal"
                        }`}
                      />
                      <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">
                        {notification.title}
                      </p>
                    </div>
                    <p className="mt-1 line-clamp-2 pl-3.5 text-[11px] leading-5 text-muted">
                      {notification.body}
                    </p>
                    <p className="mt-1 pl-3.5 text-[10px] text-muted/80">
                      {formatDateTime(notification.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-5 text-muted">
                Registration, approval, and attendance updates will appear here.
              </p>
            )}
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
        </aside>
      </div>
    </div>
  );
}

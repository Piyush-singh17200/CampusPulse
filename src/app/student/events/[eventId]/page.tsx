import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock3, MapPin, UsersRound } from "lucide-react";

import { EventPoster } from "@/components/dashboard/event-poster";
import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";

import {
  cancelRegistrationAction,
  registerForEventAction,
  saveEventAction,
  unsaveEventAction,
} from "@/features/dashboards/actions";
import { ActionForm } from "@/features/dashboards/components/action-form";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getStudentEvent } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Event details",
  robots: { index: false, follow: false },
};

export default async function StudentEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireDashboardRole("STUDENT");
  const { eventId } = await params;
  const result = await getStudentEvent(user, eventId);

  if (!result) {
    notFound();
  }

  const { event, registration, saved, activeCount, timezone, conflicts } = result;
  const poster = event.posters[0] ?? null;
  const now = new Date();
  const registrationClosed =
    event.startsAt <= now ||
    (event.registrationDeadline ? event.registrationDeadline < now : false) ||
    (event.registrationOpensAt ? event.registrationOpensAt > now : false);
  const full = event.capacity !== null && activeCount >= event.capacity;
  const registered = registration?.status === "CONFIRMED";
  const canRegister = !registered && !registrationClosed && !full && event.status === "PUBLISHED";

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow={`${event.club.name} · Event`}
        title={event.title}
        description={event.summary ?? "Event details from your college."}
        actions={
          <>
            <a
              href={`/api/calendar/events/${event.id}`}
              className={buttonStyles({ variant: "outline" })}
            >
              Add to calendar
            </a>
            <Link href="/student/discover" className={buttonStyles({ variant: "outline" })}>
              Back to discovery
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={event.status} />
          {saved ? <Badge variant="signal">Saved</Badge> : null}
          {registered ? <Badge variant="forest">Registered</Badge> : null}
          {event.categories.map(({ category }) => (
            <Badge key={category.id} variant="sage">
              {category.name}
            </Badge>
          ))}
        </div>
      </DashboardPageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-6">
          <SectionCard title="Event poster" description="Published by the organizing club.">
            <EventPoster
              poster={poster}
              eventTitle={event.title}
              priority
              emptyLabel="No poster has been published for this event."
            />
          </SectionCard>

          <SectionCard
            title="About this event"
            description="Published details from the organizing club."
          >
            {event.description ? (
              <div className="whitespace-pre-line text-[14px] leading-7 text-ink-soft">
                {event.description}
              </div>
            ) : (
              <p className="text-sm leading-7 text-muted">
                The club has not added a longer description yet.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="When and where"
            description="Times are shown in your college timezone."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3 rounded-lg border border-line bg-canvas/60 p-4">
                <CalendarDays aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-forest" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    Date and time
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-ink">
                    {formatDateRange(event.startsAt, event.endsAt, timezone)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-line bg-canvas/60 p-4">
                <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-forest" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    Venue
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-ink">
                    {event.isOnline ? "Online event" : event.venueName}
                  </p>
                  {event.venueAddress ? (
                    <p className="mt-1 text-xs text-muted">{event.venueAddress}</p>
                  ) : null}
                  {event.isOnline && event.onlineUrl ? (
                    <a
                      href={event.onlineUrl}
                      className="mt-1 block break-all text-xs font-semibold text-forest underline"
                    >
                      Join link
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-line bg-canvas/60 p-4">
                <UsersRound aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-forest" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    Capacity
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {event.capacity === null
                      ? "Unlimited"
                      : `${activeCount} of ${event.capacity} confirmed`}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-line bg-canvas/60 p-4">
                <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-forest" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    Registration
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-ink">
                    {event.registrationDeadline
                      ? `Closes ${formatDateTime(event.registrationDeadline, timezone)}`
                      : "No deadline published"}
                  </p>
                  {event.registrationOpensAt ? (
                    <p className="mt-1 text-xs text-muted">
                      Opens {formatDateTime(event.registrationOpensAt, timezone)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-6">
          {conflicts.length ? (
            <SectionCard
              title="Schedule warning"
              description="Advisory only. Registration remains available unless another rule blocks it."
            >
              <ul className="space-y-3">
                {conflicts.map((conflict) => (
                  <li
                    key={`${conflict.eventId}-${conflict.type}`}
                    className="rounded-lg border border-signal/25 bg-signal/5 p-3"
                  >
                    <p className="text-[12px] font-bold leading-5 text-ink">{conflict.title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted">
                      {conflict.startsAt && conflict.endsAt
                        ? formatDateRange(conflict.startsAt, conflict.endsAt, timezone)
                        : "Time information is incomplete."}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-signal-dark">
                      {conflict.overlapMinutes !== null
                        ? `Overlaps by about ${conflict.overlapMinutes} minute${
                            conflict.overlapMinutes === 1 ? "" : "s"
                          }.`
                        : conflict.reason}
                    </p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          <SectionCard title="Your place" description="Registration status and actions.">
            {registered ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-forest/20 bg-forest-soft/40 p-4">
                  <StatusBadge status="CONFIRMED" />
                  <p className="mt-3 text-sm font-semibold text-ink">You are registered.</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Registered{" "}
                    {registration ? formatDateTime(registration.registeredAt, timezone) : ""}.
                  </p>
                </div>
                <Link
                  href={`/student/registrations/${registration?.id}/attendance`}
                  className={buttonStyles({ variant: "signal", size: "md" })}
                >
                  Open attendance QR
                </Link>
                <ActionForm
                  action={cancelRegistrationAction}
                  fields={{ eventId: event.id }}
                  submitLabel="Cancel registration"
                  pendingLabel="Cancelling…"
                  variant="outline"
                />
              </div>
            ) : registration?.status === "ATTENDED" ? (
              <div className="space-y-4">
                <StatusBadge status="ATTENDED" />
                <p className="text-sm leading-6 text-muted">
                  Your attendance has been recorded by the event organizers.
                </p>
                <Link
                  href={`/student/registrations/${registration.id}/attendance`}
                  className={buttonStyles({ variant: "outline", size: "md" })}
                >
                  View attendance details
                </Link>
              </div>
            ) : registration?.status === "NO_SHOW" ? (
              <div className="space-y-4">
                <StatusBadge status="NO_SHOW" />
                <p className="text-sm leading-6 text-muted">
                  The organizers marked this registration as a no-show.
                </p>
              </div>
            ) : registration?.status === "CANCELLED" ? (
              <div className="space-y-4">
                <StatusBadge status="CANCELLED" />
                <p className="text-sm leading-6 text-muted">
                  Your previous registration was cancelled. You can register again if the event is
                  still open.
                </p>
                {canRegister ? (
                  <ActionForm
                    action={registerForEventAction}
                    fields={{ eventId: event.id }}
                    submitLabel="Register again"
                    variant="signal"
                  />
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-muted">
                  {registrationClosed
                    ? "Registration is closed for this event."
                    : full
                      ? "This event has reached capacity."
                      : "Reserve your place. You can cancel later from My events."}
                </p>
                {canRegister ? (
                  <ActionForm
                    action={registerForEventAction}
                    fields={{ eventId: event.id }}
                    submitLabel="Register for this event"
                    variant="signal"
                    size="md"
                  />
                ) : (
                  <p className="rounded-md border border-line bg-canvas/70 px-3 py-2 text-xs text-muted">
                    Registration is unavailable.
                  </p>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Save for later"
            description="Keep this event on your private shortlist."
          >
            <ActionForm
              action={saved ? unsaveEventAction : saveEventAction}
              fields={{ eventId: event.id }}
              submitLabel={saved ? "Remove from saved" : "Save event"}
              variant="outline"
            />
          </SectionCard>

          <SectionCard
            title="Organizer"
            description="Club details are managed by the club administrator."
          >
            <p className="text-base font-bold text-ink">{event.club.name}</p>
            {event.club.description ? (
              <p className="mt-2 text-xs leading-5 text-muted">{event.club.description}</p>
            ) : null}
            <p className="mt-3 text-xs text-muted">
              Club status: {event.club.status.toLowerCase()}
            </p>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

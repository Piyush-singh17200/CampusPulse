import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClubSwitcher } from "@/components/dashboard/club-switcher";
import { EventPoster } from "@/components/dashboard/event-poster";
import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { ActionForm, ReasonActionForm } from "@/features/dashboards/components/action-form";
import { transitionEventAction } from "@/features/dashboards/actions";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getClubEvent } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Club event",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClubEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const { eventId } = await params;
  const query = await searchParams;
  const clubId = typeof query.club === "string" ? query.club : undefined;
  const data = await getClubEvent(user, clubId, eventId);

  if (!data) {
    notFound();
  }

  const { event } = data;
  const poster = event.posters[0] ?? null;
  const editable = event.status === "DRAFT" || event.status === "REJECTED";
  const canManagePoster =
    event.status === "DRAFT" || event.status === "REJECTED" || event.status === "PUBLISHED";
  const canSubmit = editable;
  const canWithdraw = event.status === "PENDING_APPROVAL";
  const canCancel = event.status === "PENDING_APPROVAL" || event.status === "PUBLISHED";
  const canComplete = event.status === "PUBLISHED" && event.endsAt <= new Date();

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Club event"
        title={event.title}
        description={event.summary ?? "Event details and lifecycle controls."}
        actions={
          <>
            <Link
              href={`/club/events?club=${data.club?.id}`}
              className={buttonStyles({ variant: "outline" })}
            >
              Back to events
            </Link>
            {editable ? (
              <Link
                href={`/club/events/${event.id}/edit?club=${data.club?.id}`}
                className={buttonStyles()}
              >
                Edit draft
              </Link>
            ) : canManagePoster ? (
              <Link
                href={`/club/events/${event.id}/edit?club=${data.club?.id}`}
                className={buttonStyles({ variant: "outline" })}
              >
                Manage poster
              </Link>
            ) : null}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={event.status} />
          <ClubSwitcher
            clubs={data.clubs}
            activeClubId={data.club?.id ?? null}
            path={`/club/events/${event.id}`}
          />
        </div>
      </DashboardPageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <SectionCard
            title="Event overview"
            description="What students will see after publication."
          >
            <EventPoster
              poster={poster}
              eventTitle={event.title}
              className="mb-5"
              emptyLabel="No poster uploaded yet. Add one from the edit page."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">When</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-ink">
                  {formatDateRange(event.startsAt, event.endsAt)}
                </p>
              </div>
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Where
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-ink">
                  {event.isOnline ? "Online" : event.venueName}
                </p>
                {event.venueAddress ? (
                  <p className="mt-1 text-xs text-muted">{event.venueAddress}</p>
                ) : null}
              </div>
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Capacity
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {event.capacity ?? "Unlimited"}
                </p>
              </div>
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Confirmed registrations
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">{data.activeCount}</p>
              </div>
            </div>
            {event.description ? (
              <div className="mt-5 whitespace-pre-line border-t border-line pt-5 text-[14px] leading-7 text-ink-soft">
                {event.description}
              </div>
            ) : (
              <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
                No full description yet.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {event.categories.map(({ category }) => (
                <Badge key={category.id} variant="sage">
                  {category.name}
                </Badge>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Review notes"
            description="Rejection and cancellation reasons remain visible for your records."
          >
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Rejection
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  {event.rejectionReason ?? "No rejection reason."}
                  {event.rejectedAt ? (
                    <span className="block text-xs text-muted">
                      Recorded {formatDateTime(event.rejectedAt)}
                    </span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Cancellation
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  {event.cancellationReason ?? "No cancellation reason."}
                  {event.cancelledAt ? (
                    <span className="block text-xs text-muted">
                      Recorded {formatDateTime(event.cancelledAt)}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-6">
          <SectionCard title="Lifecycle" description="Existing event transitions only.">
            <div className="space-y-4">
              {canSubmit ? (
                <ActionForm
                  action={transitionEventAction}
                  fields={{ eventId: event.id, to: "PENDING_APPROVAL" }}
                  submitLabel="Submit for approval"
                  variant="signal"
                  size="md"
                />
              ) : null}
              {canComplete ? (
                <ActionForm
                  action={transitionEventAction}
                  fields={{ eventId: event.id, to: "COMPLETED" }}
                  submitLabel="Mark completed"
                  variant="outline"
                  size="md"
                />
              ) : null}
              {canWithdraw ? (
                <ReasonActionForm
                  action={transitionEventAction}
                  fields={{ eventId: event.id, to: "CANCELLED" }}
                  label="Reason for withdrawing this event"
                  placeholder="Explain why the event is being withdrawn."
                  submitLabel="Withdraw event"
                  variant="outline"
                />
              ) : null}
              {canCancel && !canWithdraw ? (
                <ReasonActionForm
                  action={transitionEventAction}
                  fields={{ eventId: event.id, to: "CANCELLED" }}
                  label="Reason for cancelling this event"
                  placeholder="Tell registered students why the event is cancelled."
                  submitLabel="Cancel event"
                  variant="signal"
                />
              ) : null}
              {!canSubmit && !canComplete && !canCancel ? (
                <p className="text-xs leading-5 text-muted">
                  No lifecycle action is available in this state.
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Registrations" description="Student places for this event.">
            <p className="text-3xl font-bold tracking-[-0.04em] text-ink">
              {event._count.registrations}
            </p>
            <p className="mt-1 text-xs text-muted">total registrations</p>
            <Link
              href={`/club/registrations?club=${data.club?.id}&eventId=${event.id}`}
              className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4" })}
            >
              View registrations
            </Link>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

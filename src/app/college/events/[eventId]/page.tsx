import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EventPoster } from "@/components/dashboard/event-poster";
import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { ActionForm, ReasonActionForm } from "@/features/dashboards/components/action-form";
import { DuplicateReviewCard } from "@/features/dashboards/components/duplicate-review";
import { transitionEventAction } from "@/features/dashboards/actions";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getCollegeEvent } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "College event detail",
  robots: { index: false, follow: false },
};

export default async function CollegeEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const { eventId } = await params;
  const data = await getCollegeEvent(user, eventId);

  if (!data) {
    notFound();
  }

  const { event } = data;
  const poster = event.posters[0] ?? null;
  const pending = event.status === "PENDING_APPROVAL";
  const published = event.status === "PUBLISHED";
  const canComplete = published && event.endsAt <= new Date();
  const canCancel = pending || published;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="College event detail"
        title={event.title}
        description={event.summary ?? "Full event record and approval controls."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {published || event.status === "COMPLETED" ? (
              <Link
                href={`/college/events/${event.id}/attendance`}
                className={buttonStyles({ variant: "signal" })}
              >
                Attendance & QR scanner
              </Link>
            ) : null}
            <Link href="/college/events" className={buttonStyles({ variant: "outline" })}>
              Back to events
            </Link>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={event.status} />
          <Link href={`/college/clubs/${event.club.id}`}>
            <Badge variant="outline">{event.club.name}</Badge>
          </Link>
          {event.categories.map(({ category }) => (
            <Badge key={category.id} variant="sage">
              {category.name}
            </Badge>
          ))}
        </div>
      </DashboardPageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <SectionCard
            title="Event record"
            description="The same published details students see, plus internal review fields."
          >
            <EventPoster
              poster={poster}
              eventTitle={event.title}
              className="mb-5"
              emptyLabel="No poster has been uploaded for this event."
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
                  {event.isOnline ? "Online event" : event.venueName}
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
                  Registrations
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">{event._count.registrations}</p>
              </div>
            </div>
            {event.description ? (
              <div className="mt-5 whitespace-pre-line border-t border-line pt-5 text-[14px] leading-7 text-ink-soft">
                {event.description}
              </div>
            ) : (
              <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
                No full description has been provided.
              </p>
            )}
          </SectionCard>

          {data.duplicates.length ? (
            <SectionCard
              title="Duplicate review"
              description="Advisory matches involving this event. Reviewing a suggestion never changes either event's status."
              bodyClassName="p-4 sm:p-5"
            >
              <div className="space-y-4">
                {data.duplicates.map((duplicate) => (
                  <DuplicateReviewCard key={duplicate.id} duplicate={duplicate} />
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Review and terminal states"
            description="Reasons are stored in the audit log and remain visible on the event record."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Rejection
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  {event.rejectionReason ?? "No rejection reason."}
                </p>
                {event.rejectedAt ? (
                  <p className="mt-1 text-xs text-muted">
                    Recorded {formatDateTime(event.rejectedAt)}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Cancellation
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  {event.cancellationReason ?? "No cancellation reason."}
                </p>
                {event.cancelledAt ? (
                  <p className="mt-1 text-xs text-muted">
                    Recorded {formatDateTime(event.cancelledAt)}
                  </p>
                ) : null}
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-6">
          <SectionCard
            title="Approval decision"
            description="Only pending events can be approved or rejected."
          >
            {pending ? (
              <div className="space-y-5">
                <ActionForm
                  action={transitionEventAction}
                  fields={{ eventId: event.id, to: "PUBLISHED" }}
                  submitLabel="Approve and publish"
                  variant="signal"
                  size="md"
                />
                <div className="border-t border-line pt-5">
                  <ReasonActionForm
                    action={transitionEventAction}
                    fields={{ eventId: event.id, to: "REJECTED" }}
                    label="Reason for rejection"
                    placeholder="Tell the club what must change before resubmission."
                    submitLabel="Reject event"
                    variant="outline"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">
                No approval decision is available while the event is{" "}
                {event.status.toLowerCase().replaceAll("_", " ")}.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Lifecycle controls"
            description="Published events can be completed after they end or cancelled with a reason."
          >
            <div className="space-y-5">
              {canComplete ? (
                <ActionForm
                  action={transitionEventAction}
                  fields={{ eventId: event.id, to: "COMPLETED" }}
                  submitLabel="Mark completed"
                  variant="outline"
                  size="md"
                />
              ) : null}
              {canCancel ? (
                <ReasonActionForm
                  action={transitionEventAction}
                  fields={{ eventId: event.id, to: "CANCELLED" }}
                  label="Reason for cancellation"
                  placeholder="This reason is stored with the event and audit entry."
                  submitLabel="Cancel event"
                  variant="signal"
                />
              ) : null}
              {!canComplete && !canCancel ? (
                <p className="text-sm leading-6 text-muted">
                  No lifecycle action is available in this state.
                </p>
              ) : null}
            </div>
          </SectionCard>

          {published || event.status === "COMPLETED" ? (
            <SectionCard
              title="Attendance & Check-in"
              description="Scan student QR codes or manage the attendance roster."
            >
              <p className="text-xs leading-5 text-muted">
                Authorized college administrators can check in attendees via live camera QR scanner
                or update attendance status.
              </p>
              <Link
                href={`/college/events/${event.id}/attendance`}
                className={buttonStyles({
                  variant: "signal",
                  size: "sm",
                  className: "mt-4 w-full justify-center",
                })}
              >
                Open QR scanner & attendance
              </Link>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Organizer"
            description="Club ownership is read from the event record."
          >
            <p className="text-base font-bold text-ink">{event.club.name}</p>
            <p className="mt-1 text-xs text-muted">
              Club status: {event.club.status.toLowerCase()}
            </p>
            {event.club.description ? (
              <p className="mt-3 text-xs leading-5 text-muted">{event.club.description}</p>
            ) : null}
            <Link
              href={`/college/clubs/${event.club.id}`}
              className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4" })}
            >
              Open club
            </Link>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

import Link from "next/link";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { ActionForm } from "@/features/dashboards/components/action-form";
import { reviewDuplicateAction } from "@/features/dashboards/actions";
import { formatDateTime } from "@/lib/format";
import type { DuplicateReview } from "@/services/duplicate-events";

function DuplicateEventSummary({
  event,
  label,
}: {
  event: DuplicateReview["primaryEvent"];
  label: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-canvas/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
          {label}
        </span>
        <StatusBadge status={event.status} />
      </div>
      <Link
        href={`/college/events/${event.id}`}
        className="mt-2 block text-[14px] font-bold leading-5 text-ink hover:text-forest"
      >
        {event.title}
      </Link>
      <p className="mt-1 text-[11px] text-muted">
        {event.club.name} · {formatDateTime(event.startsAt)}
      </p>
      <p className="mt-1 text-[11px] text-muted">
        {event.isOnline ? "Online event" : event.venueName}
      </p>
    </div>
  );
}

export function DuplicateReviewCard({ duplicate }: { duplicate: DuplicateReview }) {
  const confidence = Math.round(duplicate.confidence * 100);

  return (
    <article className="rounded-xl border border-signal/25 bg-paper p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              duplicate.status === "CONFIRMED"
                ? "forest"
                : duplicate.status === "DISMISSED"
                  ? "muted"
                  : "signal"
            }
          >
            {duplicate.status === "CONFIRMED"
              ? "Duplicate confirmed"
              : duplicate.status === "DISMISSED"
                ? "Suggestion dismissed"
                : "Possible duplicate"}
          </Badge>
          <span className="text-[11px] font-semibold text-muted">{confidence}% confidence</span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted">
          Detected {formatDateTime(duplicate.createdAt)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DuplicateEventSummary event={duplicate.primaryEvent} label="Existing event" />
        <DuplicateEventSummary event={duplicate.candidateEvent} label="Submitted event" />
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
          Why this was flagged
        </p>
        <ul className="mt-2 space-y-1">
          {duplicate.reasons.map((reason) => (
            <li key={reason} className="flex gap-2 text-[12px] leading-5 text-ink-soft">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-signal" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {duplicate.status === "PENDING" ? (
        <>
          <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-line pt-4">
            <ActionForm
              action={reviewDuplicateAction}
              fields={{ duplicateId: duplicate.id, decision: "CONFIRM" }}
              submitLabel="Confirm duplicate"
              pendingLabel="Saving…"
              variant="outline"
            />
            <ActionForm
              action={reviewDuplicateAction}
              fields={{ duplicateId: duplicate.id, decision: "DISMISS" }}
              submitLabel="Dismiss suggestion"
              pendingLabel="Saving…"
              variant="ghost"
            />
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted">
            Review only. Confirming records the decision in the audit log but does not merge,
            reject, cancel, or delete either event.
          </p>
        </>
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-[11px] leading-5 text-muted">
          {duplicate.status === "CONFIRMED"
            ? "Confirmed as a duplicate"
            : "Dismissed as a duplicate suggestion"}
          {duplicate.reviewedBy ? ` by ${duplicate.reviewedBy.name}` : ""}
          {duplicate.reviewedAt ? ` on ${formatDateTime(duplicate.reviewedAt)}` : ""}. Neither event
          was changed.
        </p>
      )}
    </article>
  );
}

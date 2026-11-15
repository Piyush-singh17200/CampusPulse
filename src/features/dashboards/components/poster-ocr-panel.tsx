"use client";

import { AlertTriangle, LoaderCircle, ScanText } from "lucide-react";
import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { ActionMessage } from "@/features/dashboards/components/action-form";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/features/dashboards/types";
import type { PosterOcrReview } from "@/services/poster-ocr";

type OcrAction = (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;

type Decision = "ACCEPT" | "REJECT" | "PENDING";

type DecisionState = Record<string, { decision: Decision; value: string }>;

const FIELD_LABELS: Record<string, string> = {
  TITLE: "Event title",
  SUMMARY: "Short summary",
  DESCRIPTION: "Description",
  START_DATE: "Start date",
  START_TIME: "Start time",
  END_DATE: "End date",
  END_TIME: "End time",
  REGISTRATION_DEADLINE_DATE: "Registration deadline date",
  REGISTRATION_DEADLINE_TIME: "Registration deadline time",
  VENUE: "Venue",
  VENUE_ADDRESS: "Venue address",
  ORGANIZER: "Organizer",
  CONTACT: "Contact",
  CATEGORY: "Category",
};

const FIELD_HINTS: Record<string, string> = {
  ORGANIZER: "Reference only. The organizing club is controlled by the event's club.",
  CONTACT: "Reference only. Add contact details to the description if students need them.",
  CATEGORY: "Applying this adds the category to the event's existing categories.",
};

const STATUS_LABEL: Record<string, string> = {
  EXTRACTED: "Extracted",
  AMBIGUOUS: "Needs review",
  INVALID: "Unreadable",
  MISSING: "Not found",
};

const STATUS_VARIANT: Record<string, "forest" | "signal" | "muted" | "outline"> = {
  EXTRACTED: "forest",
  AMBIGUOUS: "signal",
  INVALID: "signal",
  MISSING: "muted",
};

function initialDecisions(review: PosterOcrReview): DecisionState {
  return Object.fromEntries(
    review.fields.map((field) => [
      field.field,
      {
        decision:
          field.reviewStatus === "ACCEPTED"
            ? "ACCEPT"
            : field.reviewStatus === "REJECTED"
              ? "REJECT"
              : "PENDING",
        value: field.reviewedValue ?? field.value ?? "",
      },
    ]),
  );
}

function fieldInputType(field: string): "date" | "time" | "text" {
  if (field.endsWith("_DATE")) {
    return "date";
  }
  if (field.endsWith("_TIME")) {
    return "time";
  }
  return "text";
}

export function PosterOcrPanel({
  eventId,
  review,
  categories,
  runAction,
  applyAction,
}: {
  eventId: string;
  review: PosterOcrReview;
  categories: { id: string; name: string; slug: string }[];
  runAction: OcrAction;
  applyAction: OcrAction;
}) {
  const [runState, runFormAction, runPending] = useActionState(
    runAction,
    initialDashboardActionState,
  );
  const [applyState, applyFormAction, applyPending] = useActionState(
    applyAction,
    initialDashboardActionState,
  );
  const [decisions, setDecisions] = useState<DecisionState>(() => initialDecisions(review));
  const reviewableFields = review.fields.filter((field) => field.extractionStatus !== "MISSING");
  const missingFields = review.fields.filter((field) => field.extractionStatus === "MISSING");
  const payload = JSON.stringify(
    review.fields.map((field) => ({
      field: field.field,
      decision: decisions[field.field]?.decision ?? "PENDING",
      value:
        decisions[field.field]?.decision === "ACCEPT"
          ? (decisions[field.field]?.value ?? null)
          : null,
    })),
  );

  const isProcessing = review.poster.status === "PROCESSING" || review.poster.status === "PENDING";
  const canApply = review.poster.status === "COMPLETED" && reviewableFields.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              review.poster.status === "COMPLETED"
                ? "forest"
                : review.poster.status === "FAILED"
                  ? "signal"
                  : "outline"
            }
          >
            {review.poster.status === "NOT_REQUESTED"
              ? "Not started"
              : review.poster.status === "PROCESSING"
                ? "Processing"
                : review.poster.status === "PENDING"
                  ? "Queued"
                  : review.poster.status === "FAILED"
                    ? "Needs attention"
                    : "Ready to review"}
          </Badge>
          {review.poster.reviewedAt ? (
            <span className="text-[11px] text-muted">Reviewed</span>
          ) : null}
        </div>
        <form action={runFormAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="posterId" value={review.poster.id} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={runPending || isProcessing || review.poster.status === "COMPLETED"}
          >
            {runPending || isProcessing ? (
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <ScanText aria-hidden="true" className="size-3.5" />
            )}
            {review.poster.status === "FAILED" ? "Retry OCR" : "Extract details"}
          </Button>
        </form>
      </div>

      <ActionMessage state={runState} />

      {review.poster.status === "FAILED" && review.poster.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-xs leading-5 text-danger"
        >
          {review.poster.error}
        </p>
      ) : null}

      {review.poster.status === "NOT_REQUESTED" ? (
        <p className="text-xs leading-5 text-muted">
          OCR runs only when you ask it to. It does not change the event or submit it for approval.
          You can keep editing manually without using it.
        </p>
      ) : null}

      {review.poster.status === "COMPLETED" && reviewableFields.length ? (
        <>
          <p className="text-xs leading-5 text-muted">
            Review each suggestion. Choose Accept to apply the edited value, Reject to discard it,
            or leave it pending. OCR never publishes or submits an event.
          </p>
          <div className="space-y-3">
            {reviewableFields.map((field) => {
              const state = decisions[field.field] ?? { decision: "PENDING", value: "" };
              const inputType = fieldInputType(field.field);
              const isCategory = field.field === "CATEGORY";
              const label = FIELD_LABELS[field.field] ?? field.field;

              return (
                <div key={field.id} className="rounded-lg border border-line bg-paper p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-bold text-ink">{label}</span>
                        <Badge variant={STATUS_VARIANT[field.extractionStatus] ?? "outline"}>
                          {STATUS_LABEL[field.extractionStatus] ?? field.extractionStatus}
                        </Badge>
                        {field.confidence !== null ? (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                            OCR confidence {Math.round(field.confidence)}%
                          </span>
                        ) : null}
                        {field.reviewStatus !== "PENDING" ? (
                          <Badge variant={field.reviewStatus === "ACCEPTED" ? "forest" : "muted"}>
                            {field.reviewStatus === "ACCEPTED" ? "Accepted" : "Rejected"}
                          </Badge>
                        ) : null}
                      </div>
                      {field.evidence ? (
                        <p className="max-w-3xl text-[11px] leading-4 text-muted">
                          <span className="font-semibold">Poster text:</span> {field.evidence}
                        </p>
                      ) : null}
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-ink-soft">
                      Decision
                      <select
                        value={state.decision}
                        onChange={(event) =>
                          setDecisions((current) => ({
                            ...current,
                            [field.field]: {
                              ...state,
                              decision: event.target.value as Decision,
                            },
                          }))
                        }
                        className="h-8 rounded-md border border-line bg-paper px-2 text-[11px] font-semibold text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                        aria-label={`${label} review decision`}
                      >
                        <option value="PENDING">Leave pending</option>
                        <option value="ACCEPT">Accept</option>
                        <option value="REJECT">Reject</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-3">
                    {isCategory ? (
                      <select
                        value={state.value}
                        onChange={(event) =>
                          setDecisions((current) => ({
                            ...current,
                            [field.field]: { ...state, value: event.target.value },
                          }))
                        }
                        className="h-9 w-full rounded-md border border-line bg-paper px-3 text-[12px] text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                        aria-label={`${label} value`}
                      >
                        <option value="">Choose a category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    ) : field.field === "DESCRIPTION" ? (
                      <Textarea
                        value={state.value}
                        onChange={(event) =>
                          setDecisions((current) => ({
                            ...current,
                            [field.field]: { ...state, value: event.target.value },
                          }))
                        }
                        rows={4}
                        maxLength={10_000}
                        aria-label={`${label} value`}
                      />
                    ) : (
                      <Input
                        type={inputType}
                        value={state.value}
                        onChange={(event) =>
                          setDecisions((current) => ({
                            ...current,
                            [field.field]: { ...state, value: event.target.value },
                          }))
                        }
                        maxLength={field.field === "SUMMARY" ? 500 : 2_000}
                        aria-label={`${label} value`}
                      />
                    )}
                  </div>
                  {FIELD_HINTS[field.field] ? (
                    <p className="mt-1.5 text-[11px] leading-4 text-muted">
                      {FIELD_HINTS[field.field]}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {missingFields.length ? (
            <div className="rounded-lg border border-dashed border-line bg-paper-dim/50 p-3">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                <AlertTriangle aria-hidden="true" className="size-3.5" />
                Not found on this poster
              </p>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                {missingFields.map((field) => FIELD_LABELS[field.field] ?? field.field).join(", ")}.
                Add any missing details in the event form.
              </p>
            </div>
          ) : null}

          <form action={applyFormAction} className="space-y-3 border-t border-line pt-4">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="posterId" value={review.poster.id} />
            <input type="hidden" name="payload" value={payload} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={applyPending || !canApply}>
                {applyPending ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : null}
                {applyPending ? "Applying…" : "Save OCR review"}
              </Button>
              <ActionMessage state={applyState} />
            </div>
            <p className="text-[11px] leading-4 text-muted">
              Accepting a date or time only replaces that part; the other part comes from the
              event&apos;s current value. Review the event form after saving.
            </p>
          </form>
        </>
      ) : null}

      {review.poster.status === "COMPLETED" && !reviewableFields.length ? (
        <p className="text-xs leading-5 text-muted">
          No readable suggestions were produced. You can still create or edit the event manually.
        </p>
      ) : null}
    </div>
  );
}

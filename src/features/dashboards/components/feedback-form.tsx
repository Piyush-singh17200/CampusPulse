"use client";

import { LoaderCircle, MessageSquareText } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/features/dashboards/components/action-form";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/features/dashboards/types";

type FeedbackAction = (
  state: DashboardActionState,
  formData: FormData,
) => Promise<DashboardActionState>;

const ratingLabels = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Fair" },
  { value: 3, label: "Good" },
  { value: 4, label: "Very good" },
  { value: 5, label: "Excellent" },
] as const;

export function FeedbackForm({
  action,
  eventId,
  existing,
}: {
  action: FeedbackAction;
  eventId: string;
  existing?: { rating: number; comment: string | null } | null;
}) {
  const [state, formAction, pending] = useActionState(action, initialDashboardActionState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <fieldset>
        <legend className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          Overall rating
        </legend>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {ratingLabels.map((rating) => (
            <label
              key={rating.value}
              className="group cursor-pointer rounded-lg border border-line bg-paper px-1 py-2 text-center transition hover:border-forest/40 has-[:checked]:border-forest has-[:checked]:bg-forest-soft/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest"
            >
              <input
                type="radio"
                name="rating"
                value={rating.value}
                defaultChecked={existing?.rating === rating.value}
                required
                className="sr-only"
              />
              <span className="block text-lg font-bold text-ink">{rating.value}</span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">
                {rating.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          Written feedback{" "}
          <span className="font-medium normal-case tracking-normal">(optional)</span>
        </span>
        <textarea
          name="comment"
          rows={4}
          maxLength={2000}
          defaultValue={existing?.comment ?? ""}
          placeholder="What worked well? What could the organizers improve next time?"
          className="mt-1.5 w-full rounded-md border border-line-strong bg-paper px-3 py-2.5 text-[13px] leading-6 text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
        />
        <span className="mt-1 block text-[11px] text-muted">Maximum 2,000 characters.</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="signal" size="md" disabled={pending}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <MessageSquareText aria-hidden="true" className="size-4" />
          )}
          {pending ? "Saving…" : existing ? "Update feedback" : "Submit feedback"}
        </Button>
        <p className="text-[11px] leading-5 text-muted">
          Feedback is linked to your attendance record. It is not anonymous to college
          administrators.
        </p>
      </div>

      <ActionMessage state={state} />
    </form>
  );
}

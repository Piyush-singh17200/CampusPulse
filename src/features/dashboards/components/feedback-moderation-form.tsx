"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { moderateFeedbackAction } from "@/features/dashboards/actions";
import { ActionMessage } from "@/features/dashboards/components/action-form";
import { initialDashboardActionState } from "@/features/dashboards/types";

export function FeedbackModerationForm({
  feedbackId,
  moderationStatus,
}: {
  feedbackId: string;
  moderationStatus: "VISIBLE" | "HIDDEN";
}) {
  const [state, formAction, pending] = useActionState(
    moderateFeedbackAction,
    initialDashboardActionState,
  );
  const nextDecision = moderationStatus === "VISIBLE" ? "HIDDEN" : "VISIBLE";

  return (
    <form
      action={formAction}
      className="mt-3 space-y-2 rounded-lg border border-line bg-canvas/50 p-3"
    >
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <input type="hidden" name="decision" value={nextDecision} />
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        Moderation decision: {nextDecision === "HIDDEN" ? "hide" : "restore"} feedback
      </p>
      <label className="block">
        <span className="sr-only">Moderation reason</span>
        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={500}
          rows={2}
          placeholder="Required moderation reason (3–500 characters)"
          className="w-full rounded-md border border-line-strong bg-paper px-2 py-1.5 text-[11px] leading-5 text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
        />
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ShieldCheck aria-hidden="true" className="size-4" />
        )}
        {pending ? "Saving…" : nextDecision === "HIDDEN" ? "Hide feedback" : "Restore feedback"}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}

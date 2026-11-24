"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { correctAttendanceAction } from "@/features/dashboards/actions";
import { ActionMessage } from "@/features/dashboards/components/action-form";
import { initialDashboardActionState } from "@/features/dashboards/types";

export function AttendanceCorrectionForm({
  registrationId,
  currentStatus,
  studentName,
}: {
  registrationId: string;
  currentStatus: string;
  studentName: string;
}) {
  const [state, formAction, pending] = useActionState(
    correctAttendanceAction,
    initialDashboardActionState,
  );

  return (
    <form action={formAction} className="min-w-64 space-y-2">
      <input type="hidden" name="registrationId" value={registrationId} />
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
          Correct attendance for {studentName}
        </span>
        <select
          name="status"
          defaultValue={currentStatus === "NO_SHOW" ? "NO_SHOW" : "ATTENDED"}
          className="mt-1 h-9 w-full rounded-md border border-line-strong bg-paper px-2 text-[12px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <option value="ATTENDED">Attended</option>
          <option value="NO_SHOW">No show</option>
        </select>
      </label>
      <label className="block">
        <span className="sr-only">Reason for correction</span>
        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={500}
          rows={2}
          placeholder="Required reason (3–500 characters)"
          className="w-full rounded-md border border-line-strong bg-paper px-2 py-1.5 text-[11px] leading-5 text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
        />
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ShieldCheck aria-hidden="true" className="size-4" />
        )}
        {pending ? "Saving…" : "Save correction"}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}

"use client";

import { LoaderCircle, Settings2 } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { updateNotificationPreferencesAction } from "@/features/dashboards/actions";
import { ActionMessage } from "@/features/dashboards/components/action-form";
import { initialDashboardActionState } from "@/features/dashboards/types";
import type { NotificationPreferenceView } from "@/services/notifications";

const preferences = [
  {
    name: "registrationUpdates",
    label: "Registration notifications",
    description: "Registration confirmations, cancellations, and event changes.",
  },
  {
    name: "attendanceUpdates",
    label: "Attendance notifications",
    description: "Check-in confirmation and attendance updates.",
  },
  {
    name: "feedbackUpdates",
    label: "Feedback notifications",
    description: "When feedback becomes available or is updated.",
  },
] as const;

export function NotificationPreferenceForm({ initial }: { initial: NotificationPreferenceView }) {
  const [state, formAction, pending] = useActionState(
    updateNotificationPreferencesAction,
    initialDashboardActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <fieldset>
        <legend className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          In-app notifications
        </legend>
        <div className="mt-2 space-y-2">
          {preferences.map((preference) => (
            <label
              key={preference.name}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-canvas/40 p-3 transition hover:border-forest/35"
            >
              <input
                type="checkbox"
                name={preference.name}
                defaultChecked={initial[preference.name]}
                className="mt-0.5 size-4 rounded border-line-strong text-forest focus:ring-forest"
              />
              <span>
                <span className="block text-[13px] font-semibold text-ink">{preference.label}</span>
                <span className="mt-0.5 block text-[11px] leading-5 text-muted">
                  {preference.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Settings2 aria-hidden="true" className="size-4" />
          )}
          {pending ? "Saving…" : "Save preferences"}
        </Button>
        <p className="text-[11px] leading-5 text-muted">
          These settings control in-app notifications only. CampusPulse does not claim email, SMS,
          or push delivery.
        </p>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

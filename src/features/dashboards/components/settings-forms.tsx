"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ActionMessage } from "@/features/dashboards/components/action-form";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/features/dashboards/types";
import type { ClubSummary } from "@/server/dashboards/queries";

type SettingsAction = (
  state: DashboardActionState,
  formData: FormData,
) => Promise<DashboardActionState>;

export function ClubSettingsForm({ club, action }: { club: ClubSummary; action: SettingsAction }) {
  const [state, formAction, pending] = useActionState(action, initialDashboardActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="clubId" value={club.id} />
      <Field id="clubName" label="Club name" required>
        <Input id="clubName" name="name" defaultValue={club.name} required maxLength={160} />
      </Field>
      <Field
        id="clubDescription"
        label="Club description"
        description="Shown to students on event pages and in club listings."
      >
        <Textarea
          id="clubDescription"
          name="description"
          defaultValue={club.description ?? ""}
          maxLength={2000}
          rows={5}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" disabled={pending || club.status !== "ACTIVE"}>
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
          {pending ? "Saving…" : "Save club profile"}
        </Button>
        <ActionMessage state={state} />
        {club.status !== "ACTIVE" ? (
          <p className="text-xs text-muted">Only active clubs can update their profile.</p>
        ) : null}
      </div>
    </form>
  );
}

export function CollegeSettingsForm({
  college,
  action,
}: {
  college: {
    name: string;
    shortName: string | null;
    timezone: string;
    status: string;
  };
  action: SettingsAction;
}) {
  const [state, formAction, pending] = useActionState(action, initialDashboardActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field id="collegeName" label="College name" required>
        <Input id="collegeName" name="name" defaultValue={college.name} required maxLength={160} />
      </Field>
      <Field id="shortName" label="Short name" description="Used in compact navigation and labels.">
        <Input
          id="shortName"
          name="shortName"
          defaultValue={college.shortName ?? ""}
          maxLength={48}
        />
      </Field>
      <Field
        id="timezone"
        label="Timezone"
        required
        description="Use an IANA timezone such as Asia/Kolkata."
      >
        <Input
          id="timezone"
          name="timezone"
          defaultValue={college.timezone}
          required
          maxLength={64}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" disabled={pending || college.status !== "ACTIVE"}>
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
          {pending ? "Saving…" : "Save college settings"}
        </Button>
        <ActionMessage state={state} />
        {college.status !== "ACTIVE" ? (
          <p className="text-xs text-muted">Only active colleges can update settings.</p>
        ) : null}
      </div>
    </form>
  );
}

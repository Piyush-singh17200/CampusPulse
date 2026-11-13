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
import type { StudentContext } from "@/server/dashboards/queries";

type ProfileAction = (
  state: DashboardActionState,
  formData: FormData,
) => Promise<DashboardActionState>;

export function StudentProfileForm({
  context,
  action,
}: {
  context: StudentContext;
  action: ProfileAction;
}) {
  const [state, formAction, pending] = useActionState(action, initialDashboardActionState);
  const profile = context.profile;
  const selected = new Set(profile?.interests.map((item) => item.interestId) ?? []);

  if (!profile) {
    return null;
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Full name" required>
          <Input id="name" name="name" defaultValue={profile.user.name} required maxLength={160} />
        </Field>
        <Field
          id="rollNumber"
          label="Roll number"
          description="Shown only to your college administrators."
        >
          <Input
            id="rollNumber"
            name="rollNumber"
            defaultValue={profile.rollNumber ?? ""}
            maxLength={64}
          />
        </Field>
        <Field id="department" label="Department">
          <Input
            id="department"
            name="department"
            defaultValue={profile.department ?? ""}
            maxLength={120}
          />
        </Field>
        <Field id="graduationYear" label="Graduation year">
          <Input
            id="graduationYear"
            name="graduationYear"
            type="number"
            min={1900}
            max={2200}
            defaultValue={profile.graduationYear ?? ""}
          />
        </Field>
      </div>

      <Field
        id="bio"
        label="Short bio"
        description="A sentence or two about what you want to find on campus."
      >
        <Textarea id="bio" name="bio" defaultValue={profile.bio ?? ""} maxLength={500} rows={4} />
      </Field>

      <fieldset>
        <legend className="text-[13px] font-semibold text-ink">Interests</legend>
        <p className="mt-1 text-xs leading-5 text-muted">
          Choose the topics you want CampusPulse to keep in mind. These are used only for your event
          recommendations.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {context.allInterests.map((interest) => (
            <label
              key={interest.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line bg-paper px-3 py-2.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-line-strong has-checked:border-forest has-checked:bg-forest-soft/40"
            >
              <input
                type="checkbox"
                name="interestIds"
                value={interest.id}
                defaultChecked={selected.has(interest.id)}
                className="size-4 accent-forest"
              />
              {interest.name}
            </label>
          ))}
        </div>
        {context.allInterests.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-line-strong px-3 py-5 text-xs text-muted">
            Your college has not published interest options yet.
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
          {pending ? "Saving…" : "Save profile"}
        </Button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

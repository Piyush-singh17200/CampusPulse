"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ActionMessage } from "@/features/dashboards/components/action-form";
import { PosterField } from "@/features/dashboards/components/poster-field";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/features/dashboards/types";
import { toDateTimeInputValue } from "@/lib/format";
import type { DashboardEventDetail } from "@/server/dashboards/queries";

type EventAction = (
  state: DashboardActionState,
  formData: FormData,
) => Promise<DashboardActionState>;

export function EventForm({
  mode,
  clubId,
  event,
  categories,
  interests,
  action,
}: {
  mode: "create" | "edit";
  clubId: string;
  event?: DashboardEventDetail;
  categories: { id: string; name: string }[];
  interests: { id: string; name: string }[];
  action: EventAction;
}) {
  const [state, formAction, pending] = useActionState(action, initialDashboardActionState);
  const selectedCategories = new Set(event?.categories.map((item) => item.category.id) ?? []);
  const selectedInterests = new Set(event?.interests.map((item) => item.interest.id) ?? []);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="clubId" value={clubId} />
      {event ? <input type="hidden" name="eventId" value={event.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="title" label="Event title" required className="sm:col-span-2">
          <Input
            id="title"
            name="title"
            defaultValue={event?.title ?? ""}
            required
            minLength={3}
            maxLength={180}
            placeholder="e.g. Annual design showcase"
          />
        </Field>
        <Field id="summary" label="Short summary" className="sm:col-span-2">
          <Input
            id="summary"
            name="summary"
            defaultValue={event?.summary ?? ""}
            maxLength={500}
            placeholder="One clear sentence for event cards."
          />
        </Field>
        <Field id="description" label="Full description" className="sm:col-span-2">
          <Textarea
            id="description"
            name="description"
            defaultValue={event?.description ?? ""}
            maxLength={10_000}
            rows={7}
            placeholder="What should students expect?"
          />
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset className="space-y-3">
          <legend className="text-[13px] font-semibold text-ink">Categories</legend>
          <p className="text-xs leading-5 text-muted">
            Used for discovery and to explain category-based recommendations.
          </p>
          {categories.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-2.5 rounded-md border border-line bg-paper px-3 py-2.5 text-[12px] font-semibold text-ink-soft"
                >
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={category.id}
                    defaultChecked={selectedCategories.has(category.id)}
                    className="size-4 accent-forest"
                  />
                  {category.name}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">
              No active categories are configured for this college.
            </p>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-[13px] font-semibold text-ink">Interests</legend>
          <p className="text-xs leading-5 text-muted">
            Tag the event so student interest matches are explicit and explainable.
          </p>
          {interests.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {interests.map((interest) => (
                <label
                  key={interest.id}
                  className="flex items-center gap-2.5 rounded-md border border-line bg-paper px-3 py-2.5 text-[12px] font-semibold text-ink-soft"
                >
                  <input
                    type="checkbox"
                    name="interestIds"
                    value={interest.id}
                    defaultChecked={selectedInterests.has(interest.id)}
                    className="size-4 accent-forest"
                  />
                  {interest.name}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">No active interests are configured.</p>
          )}
        </fieldset>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="startsAt" label="Starts at" required>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={toDateTimeInputValue(event?.startsAt)}
          />
        </Field>
        <Field id="endsAt" label="Ends at" required>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={toDateTimeInputValue(event?.endsAt)}
          />
        </Field>
        <Field id="registrationOpensAt" label="Registration opens">
          <Input
            id="registrationOpensAt"
            name="registrationOpensAt"
            type="datetime-local"
            defaultValue={toDateTimeInputValue(event?.registrationOpensAt)}
          />
        </Field>
        <Field id="registrationDeadline" label="Registration deadline">
          <Input
            id="registrationDeadline"
            name="registrationDeadline"
            type="datetime-local"
            defaultValue={toDateTimeInputValue(event?.registrationDeadline)}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="venueName" label="Venue name" required>
          <Input
            id="venueName"
            name="venueName"
            defaultValue={event?.venueName ?? ""}
            required
            maxLength={180}
            placeholder="Main auditorium"
          />
        </Field>
        <Field id="venueAddress" label="Venue address">
          <Input
            id="venueAddress"
            name="venueAddress"
            defaultValue={event?.venueAddress ?? ""}
            maxLength={300}
            placeholder="Block C, second floor"
          />
        </Field>
        <Field id="capacity" label="Capacity" description="Leave blank for unlimited registration.">
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={100_000}
            defaultValue={event?.capacity ?? ""}
          />
        </Field>
        <div className="space-y-2">
          <label className="flex items-center gap-2.5 rounded-md border border-line bg-paper px-3 py-3 text-[13px] font-semibold text-ink-soft">
            <input
              type="checkbox"
              name="isOnline"
              value="true"
              defaultChecked={event?.isOnline ?? false}
              className="size-4 accent-forest"
            />
            This is an online event
          </label>
          <Field id="onlineUrl" label="Online event URL">
            <Input
              id="onlineUrl"
              name="onlineUrl"
              type="url"
              defaultValue={event?.onlineUrl ?? ""}
              maxLength={500}
              placeholder="https://…"
            />
          </Field>
        </div>
      </div>

      {mode === "create" ? (
        <div className="border-t border-line pt-5">
          <h2 className="text-[15px] font-bold tracking-[-0.02em] text-ink">Event poster</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Optional. Upload a JPEG, PNG, or WebP image up to 4.2 MB. You can replace or remove it
            later from the event edit page.
          </p>
          <div className="mt-4">
            <PosterField eventTitle={event?.title ?? "New event"} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
          {pending ? "Saving…" : mode === "create" ? "Save draft" : "Save changes"}
        </Button>
        <ActionMessage state={state} />
        <p className="text-xs text-muted">
          {mode === "create"
            ? "Events are created as drafts. Submit the draft for college approval when ready."
            : "Only draft or rejected events can be edited. Lifecycle changes use the actions on the event page."}
        </p>
      </div>
    </form>
  );
}

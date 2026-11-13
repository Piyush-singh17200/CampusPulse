"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useActionState } from "react";
import type { FormEvent } from "react";

import { PosterImage, type PosterView } from "@/components/dashboard/poster-image";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/features/dashboards/components/action-form";
import { PosterField } from "@/features/dashboards/components/poster-field";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/features/dashboards/types";

type PosterAction = (
  state: DashboardActionState,
  formData: FormData,
) => Promise<DashboardActionState>;

export function PosterManager({
  eventId,
  eventTitle,
  currentPoster,
  uploadAction,
  removeAction,
}: {
  eventId: string;
  eventTitle: string;
  currentPoster: PosterView | null;
  uploadAction: PosterAction;
  removeAction: PosterAction;
}) {
  const [uploadState, uploadFormAction, uploadPending] = useActionState(
    uploadAction,
    initialDashboardActionState,
  );
  const [removeState, removeFormAction, removePending] = useActionState(
    removeAction,
    initialDashboardActionState,
  );

  function confirmRemoval(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Remove this poster? This cannot be undone.")) {
      event.preventDefault();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          {currentPoster ? "Current poster" : "No poster yet"}
        </p>
        <div className="relative mt-2 aspect-[16/9] overflow-hidden rounded-lg border border-line bg-canvas">
          {currentPoster ? (
            <PosterImage
              key={currentPoster.id}
              poster={currentPoster}
              eventTitle={eventTitle}
              sizes="(min-width: 1280px) 45vw, (min-width: 768px) 60vw, 100vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6 text-center text-xs font-semibold text-muted">
              Upload a landscape poster to make this event easier to recognize.
            </div>
          )}
        </div>
      </div>

      <form action={uploadFormAction} className="space-y-4 border-t border-line pt-5">
        <input type="hidden" name="eventId" value={eventId} />
        <PosterField
          key={currentPoster?.id ?? "no-poster"}
          currentPoster={currentPoster}
          eventTitle={eventTitle}
          showCurrentPoster={false}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={uploadPending}>
            {uploadPending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            {uploadPending ? "Saving poster…" : currentPoster ? "Replace poster" : "Upload poster"}
          </Button>
          <ActionMessage state={uploadState} />
        </div>
      </form>

      {currentPoster ? (
        <form
          action={removeFormAction}
          onSubmit={confirmRemoval}
          className="border-t border-line pt-5"
        >
          <input type="hidden" name="eventId" value={eventId} />
          <Button type="submit" variant="outline" disabled={removePending}>
            {removePending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
            {removePending ? "Removing…" : "Remove poster"}
          </Button>
        </form>
      ) : null}
      <ActionMessage state={removeState} />
    </div>
  );
}

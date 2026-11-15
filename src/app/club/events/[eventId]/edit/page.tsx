import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClubSwitcher } from "@/components/dashboard/club-switcher";
import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import {
  applyPosterOcrAction,
  removePosterAction,
  runPosterOcrAction,
  updateEventAction,
  uploadPosterAction,
} from "@/features/dashboards/actions";
import { EventForm } from "@/features/dashboards/components/event-form";
import { PosterManager } from "@/features/dashboards/components/poster-manager";
import { PosterOcrPanel } from "@/features/dashboards/components/poster-ocr-panel";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getClubEvent, getClubEventFormOptions } from "@/server/dashboards/queries";
import { getPosterOcrReviewForEvent } from "@/services/poster-ocr";

export const metadata: Metadata = {
  title: "Edit event",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClubEditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const { eventId } = await params;
  const query = await searchParams;
  const clubId = typeof query.club === "string" ? query.club : undefined;
  const data = await getClubEvent(user, clubId, eventId);

  if (!data) {
    notFound();
  }

  const options = await getClubEventFormOptions(user);

  const editable = data.event.status === "DRAFT" || data.event.status === "REJECTED";
  const ocrReview =
    editable && data.event.posters.length
      ? await getPosterOcrReviewForEvent(user, data.event.id)
      : null;
  const canManagePoster =
    data.event.status === "DRAFT" ||
    data.event.status === "REJECTED" ||
    data.event.status === "PUBLISHED";
  const poster = data.event.posters[0] ?? null;
  const posterError = query.posterError === "1";

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Edit event"
        title={data.event.title}
        description="Event fields are editable for drafts and rejected submissions. Posters can be managed for drafts, rejected events, and published events."
        actions={
          <Link
            href={`/club/events/${data.event.id}?club=${data.club?.id}`}
            className={buttonStyles({ variant: "outline" })}
          >
            Back to event
          </Link>
        }
      >
        <ClubSwitcher
          clubs={data.clubs}
          activeClubId={data.club?.id ?? null}
          path={`/club/events/${data.event.id}/edit`}
        />
      </DashboardPageHeader>

      {posterError ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm leading-6 text-danger"
        >
          The event draft was created, but the poster could not be saved. Upload it again below.
        </p>
      ) : null}

      {canManagePoster ? (
        <SectionCard
          title="Event poster"
          description="JPEG, PNG, or WebP up to 5 MB. Replacing a poster creates a new asset URL and cleans up the old file after the database update."
        >
          <PosterManager
            eventId={data.event.id}
            eventTitle={data.event.title}
            currentPoster={poster}
            uploadAction={uploadPosterAction}
            removeAction={removePosterAction}
          />
        </SectionCard>
      ) : (
        <SectionCard title="Event poster" description="Poster changes follow the event lifecycle.">
          <p className="text-sm leading-6 text-muted">
            {data.event.status === "PENDING_APPROVAL"
              ? "Poster changes are locked while the event is under college review."
              : "Poster changes are not available for a cancelled or completed event."}
          </p>
        </SectionCard>
      )}

      {editable && ocrReview ? (
        <SectionCard
          title="Poster details (OCR)"
          description="Extract text locally with Tesseract, review each field, and apply only what you accept. OCR does not submit or publish the event."
        >
          <PosterOcrPanel
            key={`${ocrReview.poster.id}-${ocrReview.poster.reviewedAt?.toISOString() ?? ocrReview.poster.status}`}
            eventId={data.event.id}
            review={ocrReview}
            categories={options.categories}
            runAction={runPosterOcrAction}
            applyAction={applyPosterOcrAction}
          />
        </SectionCard>
      ) : null}

      {editable ? (
        <SectionCard
          title="Event details"
          description={`Editing ${data.club?.name ?? "your club"}.`}
        >
          <EventForm
            mode="edit"
            clubId={data.club?.id ?? ""}
            event={data.event}
            categories={options.categories}
            interests={options.interests}
            action={updateEventAction}
          />
        </SectionCard>
      ) : (
        <EmptyState
          title="Event details cannot be edited"
          description="Only draft or rejected events can have their fields edited. You can still manage the poster for a published event above. Use the lifecycle actions on the event page for review, cancellation, or completion."
          action={
            <Link
              href={`/club/events/${data.event.id}?club=${data.club?.id}`}
              className={buttonStyles({ size: "sm" })}
            >
              Open event
            </Link>
          }
        />
      )}
    </div>
  );
}

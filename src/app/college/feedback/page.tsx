import type { Metadata } from "next";
import Link from "next/link";

import {
  BarList,
  DashboardPageHeader,
  MetricCard,
  SectionCard,
} from "@/components/dashboard/primitives";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { FeedbackModerationForm } from "@/features/dashboards/components/feedback-moderation-form";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getCollegeFeedback } from "@/server/dashboards/feedback";

export const metadata: Metadata = {
  title: "College feedback",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function pageHref(filters: {
  eventId?: string;
  clubId?: string;
  rating?: string;
  status?: string;
  page?: number;
}) {
  const search = new URLSearchParams();
  if (filters.eventId) search.set("eventId", filters.eventId);
  if (filters.clubId) search.set("clubId", filters.clubId);
  if (filters.rating) search.set("rating", filters.rating);
  if (filters.status && filters.status !== "ALL") search.set("status", filters.status);
  if (filters.page && filters.page > 1) search.set("page", String(filters.page));
  const query = search.toString();
  return `/college/feedback${query ? `?${query}` : ""}`;
}

export default async function CollegeFeedbackPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const params = await searchParams;
  const data = await getCollegeFeedback(user, {
    eventId: param(params, "eventId"),
    clubId: param(params, "clubId"),
    rating: param(params, "rating"),
    status: param(params, "status"),
    page: Number(param(params, "page") ?? "1") || 1,
  });

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Feedback"
        title="Moderate campus feedback."
        description="Review feedback across completed college events. Hiding a response preserves the original record and writes an audit entry with your reason."
        actions={
          <Link href="/college/analytics" className={buttonStyles({ variant: "outline" })}>
            Analytics
          </Link>
        }
      />

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-line bg-paper p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5"
      >
        <label>
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
            Event
          </span>
          <select
            name="eventId"
            defaultValue={data.filters.eventId}
            className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[12px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <option value="">All completed events</option>
            {data.events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} · {event.club.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Club</span>
          <select
            name="clubId"
            defaultValue={data.filters.clubId}
            className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[12px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <option value="">All clubs</option>
            {data.clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
            Rating
          </span>
          <select
            name="rating"
            defaultValue={data.filters.rating}
            className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[12px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating} star{rating === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
            Moderation
          </span>
          <select
            name="status"
            defaultValue={data.filters.status}
            className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[12px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <option value="ALL">All responses</option>
            <option value="VISIBLE">Visible</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={buttonStyles({ variant: "outline", size: "md" })}>
            Apply
          </button>
          <Link href="/college/feedback" className={buttonStyles({ variant: "ghost", size: "md" })}>
            Reset
          </Link>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Average rating"
          value={data.summary.averageRating === null ? "—" : data.summary.averageRating.toFixed(1)}
          detail="Visible ratings only"
          tone="forest"
        />
        <MetricCard
          label="Responses"
          value={data.summary.responseCount}
          detail="Visible feedback responses"
        />
        <MetricCard
          label="Hidden"
          value={data.summary.hiddenCount}
          detail="Moderated responses"
          tone="signal"
        />
        <MetricCard label="Matching" value={data.total} detail="With current filters" tone="ink" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.38fr_1fr]">
        <div className="space-y-6">
          <SectionCard title="Rating distribution" description="Visible feedback only.">
            <BarList
              title="Ratings"
              valueLabel="Responses"
              items={[5, 4, 3, 2, 1].map((rating) => ({
                label: `${rating} star${rating === 1 ? "" : "s"}`,
                value: data.summary.distribution.find((item) => item.rating === rating)?.count ?? 0,
              }))}
              emptyLabel="No ratings yet."
            />
          </SectionCard>
          <SectionCard title="Feedback by event" description="Visible average rating per event.">
            <BarList
              title="Average rating"
              valueLabel="Responses"
              items={data.summary.feedbackByEvent.slice(0, 8).map((item) => ({
                label: item.title,
                value: item.responseCount,
                detail:
                  item.averageRating === null
                    ? "No visible rating"
                    : `${item.averageRating.toFixed(1)} average`,
              }))}
              emptyLabel="No feedback by event yet."
            />
          </SectionCard>
        </div>

        <SectionCard
          title="Feedback responses"
          description={`${data.total} matching response${data.total === 1 ? "" : "s"}.`}
          bodyClassName="p-0 sm:p-0"
        >
          {data.feedback.length ? (
            <ul className="divide-y divide-line">
              {data.feedback.map((feedback) => (
                <li key={feedback.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-bold text-ink">
                        {feedback.studentProfile.user.name}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        {feedback.studentProfile.rollNumber ?? "Roll number not set"} ·{" "}
                        {feedback.event.title} · {feedback.event.club.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="forest">{feedback.rating}/5</Badge>
                      <Badge variant={feedback.moderationStatus === "VISIBLE" ? "muted" : "signal"}>
                        {feedback.moderationStatus === "VISIBLE" ? "Visible" : "Hidden"}
                      </Badge>
                    </div>
                  </div>
                  {feedback.comment ? (
                    <p className="mt-3 whitespace-pre-line text-[13px] leading-6 text-ink-soft">
                      {feedback.comment}
                    </p>
                  ) : (
                    <p className="mt-3 text-[12px] italic text-muted">No written comment.</p>
                  )}
                  <p className="mt-2 text-[11px] text-muted">
                    Submitted {formatDateTime(feedback.createdAt)}
                    {feedback.moderatedAt
                      ? ` · moderated ${formatDateTime(feedback.moderatedAt)}${
                          feedback.moderatedBy ? ` by ${feedback.moderatedBy.name}` : ""
                        }`
                      : ""}
                  </p>
                  {feedback.moderationReason ? (
                    <p className="mt-1 text-[11px] leading-5 text-muted">
                      Moderation reason: {feedback.moderationReason}
                    </p>
                  ) : null}
                  <FeedbackModerationForm
                    feedbackId={feedback.id}
                    moderationStatus={feedback.moderationStatus}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No feedback matches these filters"
                description="Try a different event, club, rating, or moderation status."
              />
            </div>
          )}

          {data.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
              {data.page > 1 ? (
                <Link
                  href={pageHref({
                    eventId: data.filters.eventId,
                    clubId: data.filters.clubId,
                    rating: data.filters.rating,
                    status: data.filters.status,
                    page: data.page - 1,
                  })}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-[11px] text-muted">
                Page {data.page} of {data.totalPages}
              </span>
              {data.page < data.totalPages ? (
                <Link
                  href={pageHref({
                    eventId: data.filters.eventId,
                    clubId: data.filters.clubId,
                    rating: data.filters.rating,
                    status: data.filters.status,
                    page: data.page + 1,
                  })}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}

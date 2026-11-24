import type { Metadata } from "next";
import Link from "next/link";

import { ClubSwitcher } from "@/components/dashboard/club-switcher";
import {
  BarList,
  DashboardPageHeader,
  MetricCard,
  SectionCard,
} from "@/components/dashboard/primitives";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getClubFeedback } from "@/server/dashboards/feedback";

export const metadata: Metadata = {
  title: "Club feedback",
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
  clubId?: string;
  eventId?: string;
  rating?: string;
  status?: string;
  page?: number;
}) {
  const search = new URLSearchParams();
  if (filters.clubId) search.set("club", filters.clubId);
  if (filters.eventId) search.set("eventId", filters.eventId);
  if (filters.rating) search.set("rating", filters.rating);
  if (filters.status && filters.status !== "ALL") search.set("status", filters.status);
  if (filters.page && filters.page > 1) search.set("page", String(filters.page));
  const query = search.toString();
  return `/club/feedback${query ? `?${query}` : ""}`;
}

export default async function ClubFeedbackPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const params = await searchParams;
  const clubId = param(params, "club");
  const data = await getClubFeedback(user, clubId, {
    eventId: param(params, "eventId"),
    rating: param(params, "rating"),
    status: param(params, "status"),
    page: Number(param(params, "page") ?? "1") || 1,
  });

  if (!data.club) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader eyebrow="Feedback" title="No managed club found." />
        <EmptyState
          title="Club access required"
          description="Ask your college administrator to assign an active club manager membership."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Feedback"
        title="What students are saying."
        description="Feedback for completed events in your club. Club administrators can review responses but moderation remains with college administrators."
        actions={
          <Link
            href={`/club/events?club=${data.club.id}`}
            className={buttonStyles({ variant: "outline" })}
          >
            Manage events
          </Link>
        }
      >
        <ClubSwitcher clubs={data.clubs} activeClubId={data.club.id} path="/club/feedback" />
      </DashboardPageHeader>

      {data.events.length ? (
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper p-4 shadow-card"
        >
          <input type="hidden" name="club" value={data.club.id} />
          <label className="min-w-64 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
              Completed event
            </span>
            <select
              name="eventId"
              defaultValue={data.selectedEvent?.id ?? ""}
              className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[13px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              {data.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} · {formatDateTime(event.startsAt)}
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
              className="mt-1 h-10 rounded-md border border-line-strong bg-paper px-3 text-[12px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
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
              Visibility
            </span>
            <select
              name="status"
              defaultValue={data.filters.status}
              className="mt-1 h-10 rounded-md border border-line-strong bg-paper px-3 text-[12px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              <option value="ALL">All responses</option>
              <option value="VISIBLE">Visible</option>
              <option value="HIDDEN">Hidden</option>
            </select>
          </label>
          <button type="submit" className={buttonStyles({ variant: "outline", size: "md" })}>
            Apply
          </button>
        </form>
      ) : null}

      {data.selectedEvent ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Average rating"
              value={
                data.summary.averageRating === null ? "—" : data.summary.averageRating.toFixed(1)
              }
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
            <MetricCard
              label="Event"
              value={data.selectedEvent.title}
              detail={formatDateTime(data.selectedEvent.startsAt)}
              tone="ink"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.45fr_1fr]">
            <SectionCard title="Rating distribution" description="Visible feedback only.">
              <BarList
                title="Ratings"
                valueLabel="Responses"
                items={[5, 4, 3, 2, 1].map((rating) => ({
                  label: `${rating} star${rating === 1 ? "" : "s"}`,
                  value:
                    data.summary.distribution.find((item) => item.rating === rating)?.count ?? 0,
                }))}
                emptyLabel="No ratings yet."
              />
            </SectionCard>

            <SectionCard
              title="Feedback responses"
              description={`${data.total} response${data.total === 1 ? "" : "s"} for this event.`}
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
                            {feedback.studentProfile.department ?? "Department not set"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="forest">{feedback.rating}/5</Badge>
                          <Badge
                            variant={feedback.moderationStatus === "VISIBLE" ? "muted" : "signal"}
                          >
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
                        {feedback.updatedAt.getTime() !== feedback.createdAt.getTime()
                          ? ` · updated ${formatDateTime(feedback.updatedAt)}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-5">
                  <EmptyState
                    title="No feedback for this event"
                    description="Students can submit feedback after the event is completed and attendance is verified."
                  />
                </div>
              )}

              {data.totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
                  {data.page > 1 ? (
                    <Link
                      href={pageHref({
                        clubId: data.club.id,
                        eventId: data.selectedEvent.id,
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
                        clubId: data.club.id,
                        eventId: data.selectedEvent.id,
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
        </>
      ) : (
        <EmptyState
          title="No completed events yet"
          description="Feedback appears here after your club completes an event."
        />
      )}
    </div>
  );
}

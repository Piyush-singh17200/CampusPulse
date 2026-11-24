import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, MetricCard, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { submitFeedbackAction, updateFeedbackAction } from "@/features/dashboards/actions";
import { FeedbackForm } from "@/features/dashboards/components/feedback-form";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getStudentFeedback } from "@/server/dashboards/feedback";

export const metadata: Metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};

export default async function StudentFeedbackPage() {
  const user = await requireDashboardRole("STUDENT");
  const data = await getStudentFeedback(user);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Feedback"
        title="Tell organizers what worked."
        description="Feedback opens after an event is completed and your attendance is verified. You have 30 days to submit or edit your response."
        actions={
          <Link href="/student/registrations" className={buttonStyles({ variant: "outline" })}>
            My events
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Available"
          value={data.counts.available}
          detail="Eligible events awaiting feedback"
          tone="forest"
        />
        <MetricCard
          label="Submitted"
          value={data.counts.submitted}
          detail="Feedback responses on record"
        />
        <MetricCard
          label="Window"
          value="30 days"
          detail="After the event is completed"
          tone="signal"
        />
      </div>

      {data.rows.length ? (
        <div className="space-y-5">
          {data.rows.map((row) => (
            <SectionCard
              key={row.registrationId}
              title={row.event.title}
              description={`${row.event.club.name} · ${formatDateRange(
                row.event.startsAt,
                row.event.endsAt,
                data.timezone,
              )}`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={row.event.status} />
                  <Badge
                    variant={
                      row.state === "available"
                        ? "signal"
                        : row.state === "submitted"
                          ? "forest"
                          : "muted"
                    }
                  >
                    {row.state === "available"
                      ? "Feedback available"
                      : row.state === "submitted"
                        ? "Feedback submitted"
                        : "Window closed"}
                  </Badge>
                </div>
              }
            >
              <div className="grid gap-5 xl:grid-cols-[0.62fr_1fr]">
                <div className="space-y-3">
                  <div className="rounded-lg border border-line bg-canvas/50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                      Attendance
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {row.checkedInAt
                        ? `Checked in ${formatDateTime(row.checkedInAt, data.timezone)}`
                        : "Attendance verified"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-line bg-canvas/50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                      Feedback window
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      Closes {formatDateTime(row.windowClosesAt, data.timezone)}
                    </p>
                    {row.feedback ? (
                      <p className="mt-2 text-[11px] leading-5 text-muted">
                        Current rating: {row.feedback.rating}/5 ·{" "}
                        {row.feedback.moderationStatus === "HIDDEN"
                          ? "Hidden by a moderator"
                          : "Visible"}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/student/events/${row.event.id}`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    View event
                  </Link>
                </div>

                <div>
                  {row.canSubmit || row.canEdit ? (
                    <FeedbackForm
                      action={row.feedback ? updateFeedbackAction : submitFeedbackAction}
                      eventId={row.event.id}
                      existing={
                        row.feedback
                          ? { rating: row.feedback.rating, comment: row.feedback.comment }
                          : null
                      }
                    />
                  ) : (
                    <div className="rounded-lg border border-line bg-canvas/60 p-4 text-sm leading-6 text-muted">
                      {row.feedback
                        ? "Your feedback is recorded. The 30-day editing window has closed."
                        : "The feedback window has closed for this event."}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No feedback available yet"
          description="Attend a completed event and check back after your attendance is verified. Feedback opens for 30 days."
          action={
            <Link href="/student/discover" className={buttonStyles({ size: "sm" })}>
              Discover events
            </Link>
          }
        />
      )}
    </div>
  );
}

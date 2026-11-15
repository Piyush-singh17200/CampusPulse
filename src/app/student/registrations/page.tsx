import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, MetricCard, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { cancelRegistrationAction } from "@/features/dashboards/actions";
import { ActionForm } from "@/features/dashboards/components/action-form";
import { formatDate, formatTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getStudentRegistrations } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "My events",
  robots: { index: false, follow: false },
};

type RegistrationRow = Awaited<ReturnType<typeof getStudentRegistrations>>["upcoming"][number];

function RegistrationTable({
  rows,
  showCancel,
}: {
  rows: RegistrationRow[];
  showCancel?: boolean;
}) {
  if (!rows.length) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-[0.13em] text-muted">
            <th scope="col" className="px-3 py-3 font-bold">
              Event
            </th>
            <th scope="col" className="px-3 py-3 font-bold">
              When
            </th>
            <th scope="col" className="px-3 py-3 font-bold">
              Status
            </th>
            <th scope="col" className="px-3 py-3 text-right font-bold">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((registration) => (
            <tr
              key={registration.id}
              className="border-b border-line/70 align-top last:border-0 hover:bg-canvas/50"
            >
              <td className="px-3 py-4">
                <Link
                  href={`/student/events/${registration.event.id}`}
                  className="text-[13px] font-bold leading-5 text-ink hover:text-forest"
                >
                  {registration.event.title}
                </Link>
                <p className="mt-1 text-[11px] text-muted">{registration.event.club.name}</p>
                {registration.conflicts.length ? (
                  <p className="mt-1 text-[10px] font-semibold leading-4 text-signal-dark">
                    Overlaps with {registration.conflicts[0].title}
                    {registration.conflicts.length > 1
                      ? ` and ${registration.conflicts.length - 1} other`
                      : ""}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-4 text-[12px] leading-5 text-ink-soft">
                {formatDate(registration.event.startsAt)}
                <br />
                <span className="text-muted">{formatTime(registration.event.startsAt)}</span>
              </td>
              <td className="px-3 py-4">
                <StatusBadge status={registration.status} />
              </td>
              <td className="px-3 py-4 text-right">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {registration.status === "CONFIRMED" || registration.status === "ATTENDED" ? (
                    <Link
                      href={`/student/registrations/${registration.id}/attendance`}
                      className={buttonStyles({ variant: "outline", size: "sm" })}
                    >
                      {registration.status === "ATTENDED" ? "Attendance" : "QR check-in"}
                    </Link>
                  ) : null}
                  {showCancel && registration.status === "CONFIRMED" ? (
                    <ActionForm
                      action={cancelRegistrationAction}
                      fields={{ eventId: registration.event.id }}
                      submitLabel="Cancel"
                      pendingLabel="Cancelling…"
                      variant="ghost"
                      size="sm"
                      showMessage={false}
                      className="inline-block text-right"
                    />
                  ) : null}
                  <Link
                    href={`/student/events/${registration.event.id}`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    View
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function StudentRegistrationsPage() {
  const user = await requireDashboardRole("STUDENT");
  const data = await getStudentRegistrations(user);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="My events"
        title="Registrations, past and upcoming."
        description="Track every event you signed up for, cancel a place you no longer need, and revisit what you attended."
        actions={
          <Link href="/student/discover" className={buttonStyles()}>
            Discover events
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total" value={data.counts.total} detail="All registrations" />
        <MetricCard
          label="Confirmed"
          value={data.counts.confirmed}
          detail="Active places"
          tone="forest"
        />
        <MetricCard label="Attended" value={data.counts.attended} detail="Marked by organizers" />
        <MetricCard label="Cancelled" value={data.counts.cancelled} detail="Released places" />
      </div>

      <SectionCard
        title="Upcoming registrations"
        description="Confirmed events that have not started yet."
        bodyClassName="p-0 sm:p-0"
      >
        {data.upcoming.length ? (
          <RegistrationTable rows={data.upcoming} showCancel />
        ) : (
          <div className="p-5">
            <EmptyState
              title="No upcoming registrations"
              description="Your next event is waiting in discovery."
              action={
                <Link href="/student/discover" className={buttonStyles({ size: "sm" })}>
                  Browse events
                </Link>
              }
            />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Past and closed"
        description="Events that have started or registrations that are no longer active."
        bodyClassName="p-0 sm:p-0"
      >
        {data.past.length ? (
          <RegistrationTable rows={data.past} />
        ) : (
          <div className="p-5">
            <EmptyState
              title="No past registrations yet"
              description="Your registration history will appear here after your first event."
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

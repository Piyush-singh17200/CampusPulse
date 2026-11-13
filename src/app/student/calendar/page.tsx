import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDate, formatTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getStudentCalendar } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export default async function StudentCalendarPage() {
  const user = await requireDashboardRole("STUDENT");
  const calendar = await getStudentCalendar(user);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Calendar"
        title="Your campus schedule."
        description="Registered events are grouped by the date they start in your college timezone."
        actions={
          <Link href="/student/registrations" className={buttonStyles({ variant: "outline" })}>
            Registration history
          </Link>
        }
      />

      {calendar.groups.length ? (
        <div className="space-y-5">
          {calendar.groups.map((group) => (
            <SectionCard
              key={group.date}
              title={formatDate(new Date(`${group.date}T12:00:00Z`), calendar.timezone)}
              description={`${group.items.length} event${group.items.length === 1 ? "" : "s"}`}
              bodyClassName="p-0 sm:p-0"
            >
              <ul className="divide-y divide-line">
                {group.items.map((registration) => (
                  <li
                    key={registration.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 gap-4">
                      <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-forest-soft/50 px-2 py-2 text-center">
                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-forest">
                          Start
                        </span>
                        <span className="mt-1 text-sm font-bold text-ink">
                          {formatTime(registration.event.startsAt, calendar.timezone)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/student/events/${registration.event.id}`}
                          className="text-[14px] font-bold leading-5 text-ink hover:text-forest"
                        >
                          {registration.event.title}
                        </Link>
                        <p className="mt-1 text-xs text-muted">
                          {registration.event.club.name} ·{" "}
                          {registration.event.isOnline ? "Online" : registration.event.venueName}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={registration.status} />
                  </li>
                ))}
              </ul>
            </SectionCard>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your calendar is clear"
          description="Register for an event and it will appear here on the date it starts."
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

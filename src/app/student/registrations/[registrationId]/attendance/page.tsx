import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock3, MapPin } from "lucide-react";

import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { AttendanceQrPanel } from "@/features/dashboards/components/attendance-qr-panel";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getStudentAttendanceView } from "@/services/attendance";

export const metadata: Metadata = {
  title: "Attendance QR",
  robots: { index: false, follow: false },
};

export default async function StudentAttendancePage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const user = await requireDashboardRole("STUDENT");
  const { registrationId } = await params;
  const view = await getStudentAttendanceView(user, registrationId);

  if (!view) {
    notFound();
  }

  const { registration, event, timezone, window, canIssue, reason, attendanceRecorded } = view;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Attendance"
        title={event.title}
        description="Your attendance code is bound to this registration and this event. It cannot be used for another event."
        actions={
          <Link href="/student/registrations" className={buttonStyles({ variant: "outline" })}>
            My events
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={registration.status} />
          <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
            {attendanceRecorded ? "Attendance recorded" : canIssue ? "QR available" : "Unavailable"}
          </span>
        </div>
      </DashboardPageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
        <SectionCard
          title="Attendance QR"
          description="Generate the code only when you are ready to show it to an organizer."
        >
          <AttendanceQrPanel
            registrationId={registration.id}
            timezone={timezone}
            disabledReason={canIssue ? null : reason}
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Event details"
            description="Times are shown in your college timezone."
          >
            <div className="space-y-4">
              <div className="flex gap-3 rounded-lg border border-line bg-canvas/60 p-4">
                <CalendarDays aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-forest" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    When
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-ink">
                    {formatDateRange(event.startsAt, event.endsAt, timezone)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-line bg-canvas/60 p-4">
                <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-forest" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    Where
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-ink">
                    {event.isOnline ? "Online event" : event.venueName}
                  </p>
                  {event.venueAddress ? (
                    <p className="mt-1 text-xs leading-5 text-muted">{event.venueAddress}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-line bg-canvas/60 p-4">
                <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-forest" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    Check-in window
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-ink">
                    {formatDateTime(window.opensAt, timezone)} –{" "}
                    {formatDateTime(window.closesAt, timezone)}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    Opens two hours before the start and closes two hours after the end.
                  </p>
                </div>
              </div>
              {registration.checkedInAt ? (
                <div className="rounded-lg border border-forest/20 bg-forest-soft/35 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
                    Checked in
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {formatDateTime(registration.checkedInAt, timezone)}
                  </p>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Organizer" description="The club responsible for this event.">
            <p className="text-base font-bold text-ink">{event.club.name}</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              If your QR code cannot load, show the manual fallback code or ask the organizer to
              look up your registration by name and roll number.
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

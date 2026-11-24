import type { Metadata } from "next";
import Link from "next/link";

import { ClubSwitcher } from "@/components/dashboard/club-switcher";
import { DashboardPageHeader, MetricCard, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { AttendanceCorrectionForm } from "@/features/dashboards/components/attendance-correction-form";
import { QrScanner } from "@/features/dashboards/components/qr-scanner";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getClubAttendance } from "@/server/dashboards/queries";
import { attendanceWindow, hasEventStarted, isAttendanceWindowOpen } from "@/services/attendance";

export const metadata: Metadata = {
  title: "Attendance",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function textParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function attendancePageHref(input: {
  clubId: string;
  eventId: string;
  search: string;
  status: string;
  page: number;
}): string {
  const params = new URLSearchParams({ club: input.clubId, eventId: input.eventId });
  if (input.search) params.set("q", input.search);
  if (input.status !== "ALL") params.set("status", input.status);
  if (input.page > 1) params.set("page", String(input.page));
  return `/club/attendance?${params.toString()}`;
}

export default async function ClubAttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const params = await searchParams;
  const clubId = textParam(params, "club");
  const eventId = textParam(params, "eventId");
  const search = textParam(params, "q")?.trim() ?? "";
  const statusFilter = textParam(params, "status") ?? "ALL";
  const allowedStatuses = new Set(["ALL", "CONFIRMED", "ATTENDED", "NO_SHOW"]);
  const selectedStatus = allowedStatuses.has(statusFilter) ? statusFilter : "ALL";
  const pageParam = Number.parseInt(textParam(params, "page") ?? "1", 10);
  const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const data = await getClubAttendance(user, clubId, eventId, {
    search,
    status: selectedStatus,
    page: requestedPage,
  });

  if (!data.club) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader eyebrow="Attendance" title="No managed club found." />
        <EmptyState
          title="Club access required"
          description="Ask your college administrator to assign an active club manager membership."
        />
      </div>
    );
  }

  const registered = data.counts.confirmed + data.counts.attended + data.counts.noShow;
  const present = data.counts.attended;
  const pending = data.counts.confirmed;
  const noShow = data.counts.noShow;
  const eligible = present + pending + noShow;
  const attendancePercentage = eligible > 0 ? Math.round((present / eligible) * 1000) / 10 : null;
  const window = data.selectedEvent
    ? attendanceWindow(data.selectedEvent.startsAt, data.selectedEvent.endsAt)
    : null;
  const windowOpen = data.selectedEvent
    ? isAttendanceWindowOpen(data.selectedEvent.startsAt, data.selectedEvent.endsAt)
    : false;
  const correctionsOpen = data.selectedEvent ? hasEventStarted(data.selectedEvent.startsAt) : false;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Attendance"
        title="Record who showed up."
        description="Scan a student's event-bound QR code or use the authorized registration list for manual correction. Attendance is always validated on the server."
        actions={
          <>
            {data.selectedEvent ? (
              <a
                href={`/api/exports/club/attendance?clubId=${data.club.id}&eventId=${data.selectedEvent.id}`}
                className={buttonStyles({ variant: "outline" })}
              >
                Export attendance CSV
              </a>
            ) : null}
            <Link
              href={`/club/registrations?club=${data.club.id}`}
              className={buttonStyles({ variant: "outline" })}
            >
              Registrations
            </Link>
          </>
        }
      >
        <ClubSwitcher clubs={data.clubs} activeClubId={data.club.id} path="/club/attendance" />
      </DashboardPageHeader>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper p-4 shadow-card"
      >
        <input type="hidden" name="club" value={data.club.id} />
        <label className="min-w-64 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
            Club event
          </span>
          <select
            name="eventId"
            defaultValue={data.selectedEvent?.id ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[13px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            {data.events.length ? null : <option value="">No events available</option>}
            {data.events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} · {formatDateTime(event.startsAt)} · {event.status.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonStyles({ variant: "outline", size: "md" })}>
          Open event
        </button>
      </form>

      {data.selectedEvent ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Registered"
              value={registered}
              detail="Confirmed, attended, and no-show records"
            />
            <MetricCard
              label="Present"
              value={present}
              detail="Checked in or manually marked"
              tone="forest"
            />
            <MetricCard
              label="Pending"
              value={pending}
              detail="Confirmed but not checked in"
              tone="signal"
            />
            <MetricCard
              label="Attendance"
              value={attendancePercentage === null ? "—" : `${attendancePercentage}%`}
              detail={`${present} of ${eligible} eligible registrations`}
              tone="ink"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard
              title="QR check-in"
              description={`${data.selectedEvent.title} · ${
                data.selectedEvent.isOnline ? "Online" : data.selectedEvent.venueName
              }`}
            >
              <div className="mb-4 rounded-lg border border-line bg-canvas/50 p-3 text-xs leading-5 text-muted">
                <p className="font-semibold text-ink">
                  {formatDateTime(data.selectedEvent.startsAt)} –{" "}
                  {formatDateTime(data.selectedEvent.endsAt)}
                </p>
                {window ? (
                  <p className="mt-1">
                    Check-in window: {formatDateTime(window.opensAt)} to{" "}
                    {formatDateTime(window.closesAt)}.{" "}
                    {windowOpen ? "Open now." : "Closed outside this window."}
                  </p>
                ) : null}
              </div>
              <QrScanner
                eventId={data.selectedEvent.id}
                eventTitle={data.selectedEvent.title}
                canScan={windowOpen}
              />
            </SectionCard>

            <SectionCard
              title="Attendance register"
              description="Search by student name, roll number, or department. Corrections require a reason and are audited."
              bodyClassName="p-0 sm:p-0"
            >
              <form
                method="get"
                className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4"
              >
                <input type="hidden" name="club" value={data.club.id} />
                <input type="hidden" name="eventId" value={data.selectedEvent.id} />
                <label className="min-w-48 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
                    Search
                  </span>
                  <input
                    name="q"
                    defaultValue={search}
                    placeholder="Name, roll number, department"
                    className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[13px] text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  />
                </label>
                <label>
                  <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
                    Status
                  </span>
                  <select
                    name="status"
                    defaultValue={selectedStatus}
                    className="mt-1 h-10 rounded-md border border-line-strong bg-paper px-3 text-[12px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    <option value="ALL">All statuses</option>
                    <option value="CONFIRMED">Pending</option>
                    <option value="ATTENDED">Attended</option>
                    <option value="NO_SHOW">No show</option>
                  </select>
                </label>
                <button type="submit" className={buttonStyles({ variant: "outline", size: "md" })}>
                  Filter
                </button>
              </form>

              {data.registrations.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-line text-[10px] uppercase tracking-[0.13em] text-muted">
                        <th scope="col" className="px-4 py-3 font-bold">
                          Student
                        </th>
                        <th scope="col" className="px-4 py-3 font-bold">
                          Status
                        </th>
                        <th scope="col" className="px-4 py-3 font-bold">
                          Check-in
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-bold">
                          Correction
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.registrations.map((registration) => (
                        <tr
                          key={registration.id}
                          className="border-b border-line/70 align-top last:border-0 hover:bg-canvas/50"
                        >
                          <td className="px-4 py-4">
                            <p className="text-[13px] font-bold text-ink">
                              {registration.studentProfile.user.name}
                            </p>
                            <p className="mt-1 text-[11px] text-muted">
                              {registration.studentProfile.rollNumber ?? "Roll number not set"} ·{" "}
                              {registration.studentProfile.department ?? "Department not set"}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={registration.status} />
                          </td>
                          <td className="px-4 py-4 text-[12px] leading-5 text-ink-soft">
                            {registration.checkedInAt
                              ? formatDateTime(registration.checkedInAt)
                              : "Not checked in"}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {correctionsOpen ? (
                              <details className="inline-block text-left">
                                <summary className="cursor-pointer list-none rounded-md border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:border-forest/40">
                                  Correct attendance
                                </summary>
                                <div className="mt-2">
                                  <AttendanceCorrectionForm
                                    registrationId={registration.id}
                                    currentStatus={registration.status}
                                    studentName={registration.studentProfile.user.name}
                                  />
                                </div>
                              </details>
                            ) : (
                              <span className="text-[11px] leading-5 text-muted">
                                Corrections open after the event starts.
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState
                    title="No matching attendance records"
                    description={
                      registered
                        ? "Try a different search or status filter."
                        : "No confirmed registrations are available for this event."
                    }
                  />
                </div>
              )}

              {data.totalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
                  <p className="text-[11px] leading-5 text-muted">
                    Page {data.page} of {data.totalPages} · {data.total} matching registration
                    {data.total === 1 ? "" : "s"}
                  </p>
                  <div className="flex items-center gap-2">
                    {data.page > 1 ? (
                      <Link
                        href={attendancePageHref({
                          clubId: data.club.id,
                          eventId: data.selectedEvent.id,
                          search,
                          status: selectedStatus,
                          page: data.page - 1,
                        })}
                        className={buttonStyles({ variant: "outline", size: "sm" })}
                      >
                        Previous
                      </Link>
                    ) : null}
                    {data.page < data.totalPages ? (
                      <Link
                        href={attendancePageHref({
                          clubId: data.club.id,
                          eventId: data.selectedEvent.id,
                          search,
                          status: selectedStatus,
                          page: data.page + 1,
                        })}
                        className={buttonStyles({ variant: "outline", size: "sm" })}
                      >
                        Next
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </SectionCard>
          </div>

          {noShow > 0 ? (
            <p className="text-[11px] leading-5 text-muted">
              {noShow} registration{noShow === 1 ? "" : "s"} marked no-show. Attendance percentage
              uses checked-in registrations divided by all eligible registrations.
            </p>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No events available for attendance"
          description="Attendance is available for published or completed club events. Create or publish an event first."
        />
      )}
    </div>
  );
}

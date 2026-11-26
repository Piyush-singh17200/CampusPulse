import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageHeader, MetricCard, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { AttendanceCorrectionForm } from "@/features/dashboards/components/attendance-correction-form";
import { QrScanner } from "@/features/dashboards/components/qr-scanner";
import { formatDateTime } from "@/lib/format";
import { requireAnyDashboardRole } from "@/server/auth/page-guard";
import { getCollegeEventAttendance } from "@/server/dashboards/queries";
import { attendanceWindow, hasEventStarted, isAttendanceWindowOpen } from "@/services/attendance";

export const metadata: Metadata = {
  title: "Event attendance",
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
  eventId: string;
  search: string;
  status: string;
  page: number;
}): string {
  const params = new URLSearchParams();
  if (input.search) params.set("q", input.search);
  if (input.status !== "ALL") params.set("status", input.status);
  if (input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query
    ? `/college/events/${input.eventId}/attendance?${query}`
    : `/college/events/${input.eventId}/attendance`;
}

export default async function CollegeEventAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireAnyDashboardRole(["COLLEGE_ADMIN", "SUPER_ADMIN"]);
  const { eventId } = await params;
  const searchParamsData = await searchParams;

  const search = textParam(searchParamsData, "q")?.trim() ?? "";
  const statusFilter = textParam(searchParamsData, "status") ?? "ALL";
  const allowedStatuses = new Set(["ALL", "CONFIRMED", "ATTENDED", "NO_SHOW"]);
  const selectedStatus = allowedStatuses.has(statusFilter) ? statusFilter : "ALL";
  const pageParam = Number.parseInt(textParam(searchParamsData, "page") ?? "1", 10);
  const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const data = await getCollegeEventAttendance(user, eventId, {
    search,
    status: selectedStatus,
    page: requestedPage,
  });

  if (!data) {
    notFound();
  }

  const { event, registrations, counts, total, page, totalPages } = data;
  const registered = counts.confirmed + counts.attended + counts.noShow;
  const present = counts.attended;
  const pending = counts.confirmed;
  const noShow = counts.noShow;
  const eligible = present + pending + noShow;
  const attendancePercentage = eligible > 0 ? Math.round((present / eligible) * 1000) / 10 : null;

  const window = attendanceWindow(event.startsAt, event.endsAt);
  const windowOpen = isAttendanceWindowOpen(event.startsAt, event.endsAt);
  const correctionsOpen = hasEventStarted(event.startsAt);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow={`Attendance · ${event.club.name}`}
        title={`Check-in & Roster: ${event.title}`}
        description="Scan student QR codes via the device camera or review and correct registrations. Attendance validation runs server-side."
        actions={
          <>
            <a
              href={`/api/exports/club/attendance?clubId=${event.clubId}&eventId=${event.id}`}
              className={buttonStyles({ variant: "outline" })}
            >
              Export attendance CSV
            </a>
            <Link
              href={`/college/events/${event.id}`}
              className={buttonStyles({ variant: "outline" })}
            >
              Back to event
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Registered"
          value={registered}
          detail="Confirmed, attended, and no-show records"
        />
        <MetricCard
          label="Present"
          value={present}
          detail="Checked in or manually verified"
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
          detail={`${present} of ${eligible} eligible attendees`}
          tone="ink"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="QR check-in scanner"
          description={`${event.title} · ${event.isOnline ? "Online" : event.venueName}`}
        >
          <div className="mb-4 rounded-lg border border-line bg-canvas/50 p-3 text-xs leading-5 text-muted">
            <p className="font-semibold text-ink">
              {formatDateTime(event.startsAt)} – {formatDateTime(event.endsAt)}
            </p>
            <p className="mt-1">
              Check-in window: {formatDateTime(window.opensAt)} to {formatDateTime(window.closesAt)}
              . {windowOpen ? "Open now." : "Closed outside this window."}
            </p>
          </div>
          <QrScanner eventId={event.id} eventTitle={event.title} canScan={windowOpen} />
        </SectionCard>

        <SectionCard
          title="Attendance register"
          description="Search attendees or adjust check-in status. Corrections require an audit reason."
          bodyClassName="p-0 sm:p-0"
        >
          <form
            method="get"
            className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4"
          >
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

          {registrations.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-[0.13em] text-muted">
                    <th scope="col" className="px-4 py-3 font-bold">
                      Student
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Checked in
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Correction
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-[13px]">
                  {registrations.map((registration) => (
                    <tr key={registration.id} className="hover:bg-paper-dim/40">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-ink">
                          {registration.studentProfile.user.name}
                        </p>
                        <p className="text-[11px] text-muted">
                          {registration.studentProfile.rollNumber ?? "No roll number"} ·{" "}
                          {registration.studentProfile.department ?? "No dept"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={registration.status} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted">
                        {registration.checkedInAt ? formatDateTime(registration.checkedInAt) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {correctionsOpen ? (
                          <AttendanceCorrectionForm
                            registrationId={registration.id}
                            currentStatus={registration.status}
                            studentName={registration.studentProfile.user.name}
                          />
                        ) : (
                          <span className="text-xs text-muted">Available after start</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                title="No attendees found"
                description={
                  search || selectedStatus !== "ALL"
                    ? "Try adjusting search or status filters."
                    : "No confirmed registrations exist for this event yet."
                }
              />
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted">
              <span>
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={attendancePageHref({
                      eventId: event.id,
                      search,
                      status: selectedStatus,
                      page: page - 1,
                    })}
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                  >
                    Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={attendancePageHref({
                      eventId: event.id,
                      search,
                      status: selectedStatus,
                      page: page + 1,
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
    </div>
  );
}

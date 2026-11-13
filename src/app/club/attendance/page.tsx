import type { Metadata } from "next";
import Link from "next/link";

import { ClubSwitcher } from "@/components/dashboard/club-switcher";
import { DashboardPageHeader, MetricCard, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { markAttendanceAction } from "@/features/dashboards/actions";
import { ActionForm } from "@/features/dashboards/components/action-form";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getClubAttendance } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Attendance",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClubAttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const params = await searchParams;
  const clubId = typeof params.club === "string" ? params.club : undefined;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const data = await getClubAttendance(user, clubId, eventId);

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

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Attendance"
        title="Record who showed up."
        description="Attendance uses the existing registration status model. QR check-in is not implemented yet, so organizers record final attendance after an event starts."
        actions={
          <Link
            href={`/club/registrations?club=${data.club.id}`}
            className={buttonStyles({ variant: "outline" })}
          >
            Registrations
          </Link>
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
            Event that has started
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
        <button type="submit" className={buttonStyles({ variant: "outline", size: "md" })}>
          Open event
        </button>
      </form>

      {data.selectedEvent ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Awaiting"
              value={data.counts.confirmed}
              detail="Confirmed, not yet recorded"
              tone="signal"
            />
            <MetricCard
              label="Attended"
              value={data.counts.attended}
              detail="Marked present"
              tone="forest"
            />
            <MetricCard label="No show" value={data.counts.noShow} detail="Marked absent" />
          </div>

          <SectionCard
            title={data.selectedEvent.title}
            description={`${formatDateTime(data.selectedEvent.startsAt)} · ${data.selectedEvent.status.toLowerCase()}`}
            bodyClassName="p-0 sm:p-0"
          >
            {data.registrations.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line text-[10px] uppercase tracking-[0.13em] text-muted">
                      <th scope="col" className="px-4 py-3 font-bold">
                        Student
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Roll number
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-bold">
                        Record
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
                            {registration.studentProfile.department ?? "Department not set"}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-[12px] text-ink-soft">
                          {registration.studentProfile.rollNumber ?? "—"}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={registration.status} />
                        </td>
                        <td className="px-4 py-4">
                          {registration.status === "CONFIRMED" ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <ActionForm
                                action={markAttendanceAction}
                                fields={{ registrationId: registration.id, status: "ATTENDED" }}
                                submitLabel="Attended"
                                variant="outline"
                                size="sm"
                                showMessage={false}
                              />
                              <ActionForm
                                action={markAttendanceAction}
                                fields={{ registrationId: registration.id, status: "NO_SHOW" }}
                                submitLabel="No show"
                                variant="ghost"
                                size="sm"
                                showMessage={false}
                              />
                            </div>
                          ) : (
                            <p className="text-right text-[11px] text-muted">Recorded</p>
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
                  title="No attendance records"
                  description="No confirmed registrations are available for this event."
                />
              </div>
            )}
          </SectionCard>
        </>
      ) : (
        <EmptyState
          title="No events ready for attendance"
          description="Attendance is available only for published or completed events that have already started."
        />
      )}
    </div>
  );
}

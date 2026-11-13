import type { Metadata } from "next";
import Link from "next/link";

import { ClubSwitcher } from "@/components/dashboard/club-switcher";
import { DashboardPageHeader, MetricCard, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getClubRegistrations } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Club registrations",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClubRegistrationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const params = await searchParams;
  const clubId = typeof params.club === "string" ? params.club : undefined;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const data = await getClubRegistrations(user, clubId, eventId);

  if (!data.club) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader eyebrow="Registrations" title="No managed club found." />
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
        eyebrow="Registrations"
        title="Who is coming."
        description="Event-wise registration totals and the student information your club is authorized to see."
        actions={
          <Link
            href={`/club/events?club=${data.club.id}`}
            className={buttonStyles({ variant: "outline" })}
          >
            Manage events
          </Link>
        }
      >
        <ClubSwitcher clubs={data.clubs} activeClubId={data.club.id} path="/club/registrations" />
      </DashboardPageHeader>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper p-4 shadow-card"
      >
        <input type="hidden" name="club" value={data.club.id} />
        <label className="min-w-64 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
            Event
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total" value={data.counts.total} detail="All registrations" />
            <MetricCard
              label="Confirmed"
              value={data.counts.confirmed}
              detail="Active places"
              tone="forest"
            />
            <MetricCard label="Attended" value={data.counts.attended} detail="Checked in" />
            <MetricCard label="Cancelled" value={data.counts.cancelled} detail="Released places" />
          </div>

          <SectionCard
            title={data.selectedEvent.title}
            description={`${data.selectedEvent.status.toLowerCase().replaceAll("_", " ")} · ${formatDateTime(data.selectedEvent.startsAt)}`}
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
                        Department
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Registered
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
                            {registration.studentProfile.user.email}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-[12px] text-ink-soft">
                          {registration.studentProfile.rollNumber ?? "—"}
                        </td>
                        <td className="px-4 py-4 text-[12px] text-ink-soft">
                          {registration.studentProfile.department ?? "—"}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={registration.status} />
                        </td>
                        <td className="px-4 py-4 text-[12px] text-ink-soft">
                          {formatDateTime(registration.registeredAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  title="No registrations yet"
                  description="When students register, their permitted details will appear here."
                />
              </div>
            )}
          </SectionCard>
        </>
      ) : (
        <EmptyState
          title="No events available"
          description="Create an event before registrations can be viewed."
          action={
            <Link
              href={`/club/events/create?club=${data.club.id}`}
              className={buttonStyles({ size: "sm" })}
            >
              Create event
            </Link>
          }
        />
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { ClubSwitcher } from "@/components/dashboard/club-switcher";
import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getClubEvents } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Club events",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const statuses = [
  ["", "All statuses"],
  ["DRAFT", "Draft"],
  ["PENDING_APPROVAL", "Pending approval"],
  ["PUBLISHED", "Published"],
  ["REJECTED", "Rejected"],
  ["CANCELLED", "Cancelled"],
  ["COMPLETED", "Completed"],
];

export default async function ClubEventsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const params = await searchParams;
  const clubId = typeof params.club === "string" ? params.club : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const data = await getClubEvents(user, clubId, status);

  if (!data.club) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader eyebrow="Club workspace" title="No managed club found." />
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
        eyebrow="Event operations"
        title="Every event, one clear lifecycle."
        description="Create drafts, submit them for college review, track published events, and keep your club's history accurate."
        actions={
          <Link href={`/club/events/create?club=${data.club.id}`} className={buttonStyles()}>
            Create event
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <ClubSwitcher clubs={data.clubs} activeClubId={data.club.id} path="/club/events" />
        </div>
      </DashboardPageHeader>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper p-4 shadow-card"
      >
        <input type="hidden" name="club" value={data.club.id} />
        <label className="min-w-44">
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
            Status
          </span>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[13px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonStyles({ variant: "outline", size: "md" })}>
          Apply filter
        </button>
      </form>

      <SectionCard
        title="Club events"
        description={`${data.events.length} event${data.events.length === 1 ? "" : "s"} in this view.`}
        bodyClassName="p-0 sm:p-0"
      >
        {data.events.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.13em] text-muted">
                  <th scope="col" className="px-4 py-3 font-bold">
                    Event
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Starts
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Registrations
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-line/70 align-top last:border-0 hover:bg-canvas/50"
                  >
                    <td className="px-4 py-4">
                      <Link
                        href={`/club/events/${event.id}?club=${data.club?.id}`}
                        className="text-[13px] font-bold text-ink hover:text-forest"
                      >
                        {event.title}
                      </Link>
                      <p className="mt-1 text-[11px] text-muted">
                        {event.isOnline ? "Online" : event.venueName}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-[12px] leading-5 text-ink-soft">
                      {formatDateTime(event.startsAt)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="px-4 py-4 text-[12px] font-semibold text-ink">
                      {event._count.registrations}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/club/events/${event.id}?club=${data.club?.id}`}
                          className={buttonStyles({ variant: "outline", size: "sm" })}
                        >
                          Open
                        </Link>
                        {event.status === "DRAFT" || event.status === "REJECTED" ? (
                          <Link
                            href={`/club/events/${event.id}/edit?club=${data.club?.id}`}
                            className={buttonStyles({ variant: "ghost", size: "sm" })}
                          >
                            Edit
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No events in this view"
              description="Create a draft or change the status filter."
              action={
                <Link
                  href={`/club/events/create?club=${data.club.id}`}
                  className={buttonStyles({ size: "sm" })}
                >
                  Create event
                </Link>
              }
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

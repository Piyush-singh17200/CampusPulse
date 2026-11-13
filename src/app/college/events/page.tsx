import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getCollegeEvents } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "College events",
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

export default async function CollegeEventsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const data = await getCollegeEvents(user, status);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Event oversight"
        title="Every event in your college."
        description="Review event states, open an event for its full record, and move approvals forward from the approvals queue."
        actions={
          <Link href="/college/approvals" className={buttonStyles()}>
            Open approvals
          </Link>
        }
      />

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper p-4 shadow-card"
      >
        <label className="min-w-48">
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
        title="Event register"
        description={`${data.events.length} event${data.events.length === 1 ? "" : "s"} in this view.`}
        bodyClassName="p-0 sm:p-0"
      >
        {data.events.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.13em] text-muted">
                  <th scope="col" className="px-4 py-3 font-bold">
                    Event
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Club
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
                        href={`/college/events/${event.id}`}
                        className="text-[13px] font-bold text-ink hover:text-forest"
                      >
                        {event.title}
                      </Link>
                      <p className="mt-1 text-[11px] text-muted">
                        {event.isOnline ? "Online" : event.venueName}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-[12px] text-ink-soft">{event.club.name}</td>
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
                          href={`/college/events/${event.id}`}
                          className={buttonStyles({ variant: "outline", size: "sm" })}
                        >
                          Open
                        </Link>
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
              description="Change the status filter to see more of the college event register."
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getCollegeClubs } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "College clubs",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const statuses = [
  ["", "All statuses"],
  ["PENDING", "Pending"],
  ["ACTIVE", "Active"],
  ["REJECTED", "Rejected"],
  ["SUSPENDED", "Suspended"],
  ["ARCHIVED", "Archived"],
];

export default async function CollegeClubsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const data = await getCollegeClubs(user, status);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Clubs"
        title="The organizations behind campus events."
        description="Review club status, membership size, and event activity. Open a club for its full membership and event record."
        actions={
          <Link href="/college/approvals" className={buttonStyles()}>
            Pending applications
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

      {data.clubs.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.clubs.map((club) => (
            <article
              key={club.id}
              className="flex flex-col rounded-xl border border-line bg-paper p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-forest">
                    Club
                  </p>
                  <h2 className="mt-2 text-[18px] font-bold leading-tight tracking-[-0.02em] text-ink">
                    <Link href={`/college/clubs/${club.id}`} className="hover:text-forest">
                      {club.name}
                    </Link>
                  </h2>
                </div>
                <StatusBadge status={club.status} />
              </div>
              {club.description ? (
                <p className="mt-3 line-clamp-3 text-[13px] leading-6 text-muted">
                  {club.description}
                </p>
              ) : null}
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-[12px]">
                <div>
                  <dt className="text-muted">Members</dt>
                  <dd className="mt-1 text-lg font-bold text-ink">{club._count.memberships}</dd>
                </div>
                <div>
                  <dt className="text-muted">Events</dt>
                  <dd className="mt-1 text-lg font-bold text-ink">{club._count.events}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] text-muted">
                Created {formatDateTime(club.createdAt)}
                {club.createdBy ? ` · by ${club.createdBy.name}` : ""}
              </p>
              <div className="mt-auto pt-5">
                <Link
                  href={`/college/clubs/${club.id}`}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  Open club record
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <SectionCard title="Club directory" description="No clubs match the current filter.">
          <EmptyState
            title="No clubs in this view"
            description="Change the status filter to see more club records."
          />
        </SectionCard>
      )}
    </div>
  );
}

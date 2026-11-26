import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { CreateCollegeModal } from "@/features/dashboards/components/create-college-modal";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getPlatformColleges } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Platform colleges",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function pageNumber(value: string | string[] | undefined): number {
  const parsed = Number(single(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function pageHref(filters: { q: string; status: string }, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/platform/colleges?${query}` : "/platform/colleges";
}

export default async function PlatformCollegesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("SUPER_ADMIN");
  const params = await searchParams;
  const data = await getPlatformColleges(user, {
    q: single(params.q),
    status: single(params.status),
    page: pageNumber(params.page),
  });

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Tenants"
        title="Colleges on CampusPulse."
        description="Inspect tenant records and change lifecycle status. Suspending or archiving a college revokes its users' sessions."
        actions={<CreateCollegeModal />}
      />

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-line bg-paper p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1.5fr_0.8fr_auto] lg:items-end"
      >
        <label>
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
            Search
          </span>
          <input
            name="q"
            type="search"
            defaultValue={data.filters.q}
            placeholder="Name, slug, or domain"
            className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[13px] text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
          />
        </label>
        <label>
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
            Status
          </span>
          <select
            name="status"
            defaultValue={data.filters.status}
            className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[13px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className={buttonStyles({ className: "h-10" })}>
            Apply
          </button>
          <Link
            href="/platform/colleges"
            className={buttonStyles({ variant: "outline", className: "h-10" })}
          >
            Reset
          </Link>
        </div>
      </form>

      <SectionCard
        title="College directory"
        description={`${data.total} college${data.total === 1 ? "" : "s"} in this view.`}
        bodyClassName="p-0 sm:p-0"
      >
        {data.colleges.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.13em] text-muted">
                  <th scope="col" className="px-4 py-3 font-bold">
                    College
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Users
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Clubs
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Events
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Created
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.colleges.map((college) => (
                  <tr
                    key={college.id}
                    className="border-b border-line/70 align-top last:border-0 hover:bg-canvas/50"
                  >
                    <td className="px-4 py-4">
                      <Link
                        href={`/platform/colleges/${college.id}`}
                        className="text-[13px] font-bold text-ink hover:text-forest"
                      >
                        {college.name}
                      </Link>
                      <p className="mt-1 text-[11px] text-muted">
                        {college.slug} · {college.primaryDomain ?? "No domain"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={college.status} />
                    </td>
                    <td className="px-4 py-4 text-[12px] font-semibold text-ink">
                      {college._count.users}
                    </td>
                    <td className="px-4 py-4 text-[12px] font-semibold text-ink">
                      {college._count.clubs}
                    </td>
                    <td className="px-4 py-4 text-[12px] font-semibold text-ink">
                      {college._count.events}
                    </td>
                    <td className="px-4 py-4 text-[12px] text-ink-soft">
                      {formatDateTime(college.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/platform/colleges/${college.id}`}
                        className={buttonStyles({ variant: "outline", size: "sm" })}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No colleges match"
              description="Change the search or status filter."
            />
          </div>
        )}
      </SectionCard>

      {data.totalPages > 1 ? (
        <nav
          aria-label="College pagination"
          className="flex items-center justify-between gap-3 border-t border-line pt-5"
        >
          {data.page > 1 ? (
            <Link
              href={pageHref(data.filters, data.page - 1)}
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs font-semibold text-muted">
            Page {data.page} of {data.totalPages}
          </p>
          {data.page < data.totalPages ? (
            <Link
              href={pageHref(data.filters, data.page + 1)}
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

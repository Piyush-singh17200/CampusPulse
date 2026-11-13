import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { SelectActionForm } from "@/features/dashboards/components/action-form";
import { changeUserRoleAction, changeUserStatusAction } from "@/features/dashboards/actions";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getCollegeUsers } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "College users",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const roleOptions = [
  { value: "STUDENT", label: "Student" },
  { value: "CLUB_ADMIN", label: "Club admin" },
  { value: "COLLEGE_ADMIN", label: "College admin" },
];

const statusOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DISABLED", label: "Disabled" },
];

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function pageNumber(value: string | string[] | undefined): number {
  const parsed = Number(single(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function pageHref(filters: { q: string; role: string; status: string }, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/college/users?${query}` : "/college/users";
}

export default async function CollegeUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const params = await searchParams;
  const data = await getCollegeUsers(user, {
    q: single(params.q),
    role: single(params.role),
    status: single(params.status),
    page: pageNumber(params.page),
  });

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="People"
        title="Manage the college community."
        description="Search users, change supported roles, and suspend or disable access. Every change revokes sessions and is audited."
      />

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-line bg-paper p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto] lg:items-end"
      >
        <label>
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
            Search
          </span>
          <input
            name="q"
            type="search"
            defaultValue={data.filters.q}
            placeholder="Name or email"
            className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[13px] text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
          />
        </label>
        <label>
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Role</span>
          <select
            name="role"
            defaultValue={data.filters.role}
            className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[13px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <option value="">All roles</option>
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="SUPER_ADMIN">Platform admin</option>
          </select>
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
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="INVITED">Invited</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className={buttonStyles({ className: "h-10" })}>
            Apply
          </button>
          <Link
            href="/college/users"
            className={buttonStyles({ variant: "outline", className: "h-10" })}
          >
            Reset
          </Link>
        </div>
      </form>

      <SectionCard
        title="User directory"
        description={`${data.total} user${data.total === 1 ? "" : "s"} in this view.`}
        bodyClassName="p-0 sm:p-0"
      >
        {data.users.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.13em] text-muted">
                  <th scope="col" className="px-4 py-3 font-bold">
                    User
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Clubs
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Joined
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">
                    Manage
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((row) => {
                  const isSelf = row.id === user.id;
                  const protectedPlatformAdmin = row.role === "SUPER_ADMIN";

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-line/70 align-top last:border-0 hover:bg-canvas/50"
                    >
                      <td className="px-4 py-4">
                        <p className="text-[13px] font-bold text-ink">{row.name}</p>
                        <p className="mt-1 text-[11px] text-muted">{row.email}</p>
                        {row.studentProfile ? (
                          <p className="mt-1 text-[11px] text-muted">
                            {[
                              row.studentProfile.rollNumber,
                              row.studentProfile.department,
                              row.studentProfile.graduationYear
                                ? `Class of ${row.studentProfile.graduationYear}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={row.role} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-4 text-[12px] leading-5 text-ink-soft">
                        {row.clubMemberships.length
                          ? row.clubMemberships
                              .map(
                                (membership) =>
                                  `${membership.club.name} (${membership.role.toLowerCase().replaceAll("_", " ")})`,
                              )
                              .join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-4 text-[12px] text-ink-soft">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        {isSelf ? (
                          <p className="text-right text-[11px] text-muted">Your account</p>
                        ) : protectedPlatformAdmin ? (
                          <p className="text-right text-[11px] text-muted">Platform-managed</p>
                        ) : (
                          <div className="flex flex-col items-end gap-3">
                            <SelectActionForm
                              action={changeUserRoleAction}
                              fields={{ targetUserId: row.id }}
                              selectName="role"
                              label="Role"
                              options={roleOptions}
                              defaultValue={row.role}
                              submitLabel="Save role"
                            />
                            <SelectActionForm
                              action={changeUserStatusAction}
                              fields={{ targetUserId: row.id }}
                              selectName="status"
                              label="Status"
                              options={statusOptions}
                              defaultValue={row.status}
                              submitLabel="Save status"
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No users match this view"
              description="Change the search or filters to find someone."
            />
          </div>
        )}
      </SectionCard>

      {data.totalPages > 1 ? (
        <nav
          aria-label="User pagination"
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

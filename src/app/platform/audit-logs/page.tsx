import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime, titleCase } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getPlatformAuditLogs } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Platform audit history",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const actions = [
  ["", "All actions"],
  ["USER_ROLE_CHANGED", "User role changed"],
  ["USER_STATUS_CHANGED", "User status changed"],
  ["USER_PROFILE_UPDATED", "User profile updated"],
  ["COLLEGE_CREATED", "College created"],
  ["COLLEGE_UPDATED", "College updated"],
  ["CLUB_APPROVED", "Club approved"],
  ["CLUB_REJECTED", "Club rejected"],
  ["CLUB_UPDATED", "Club updated"],
  ["EVENT_CREATED", "Event created"],
  ["EVENT_UPDATED", "Event updated"],
  ["EVENT_APPROVED", "Event approved"],
  ["EVENT_REJECTED", "Event rejected"],
  ["EVENT_CANCELLED", "Event cancelled"],
  ["EVENT_STATUS_CHANGED", "Event status changed"],
  ["REGISTRATION_STATUS_CHANGED", "Registration status changed"],
  ["SAVED_EVENT_CHANGED", "Saved event changed"],
  ["NOTIFICATION_READ", "Notification read"],
];

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function pageNumber(value: string | string[] | undefined): number {
  const parsed = Number(single(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default async function PlatformAuditLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("SUPER_ADMIN");
  const params = await searchParams;
  const action = single(params.action);
  const data = await getPlatformAuditLogs(user, { page: pageNumber(params.page), action });

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Audit history"
        title="Every administrative action, across every tenant."
        description="Platform audit history is read-only. Entries are written transactionally by domain services and metadata is redacted before storage."
      />

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper p-4 shadow-card"
      >
        <label className="min-w-60 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
            Action
          </span>
          <select
            name="action"
            defaultValue={action}
            className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[13px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            {actions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonStyles({ variant: "outline", size: "md" })}>
          Apply filter
        </button>
        <Link
          href="/platform/audit-logs"
          className={buttonStyles({ variant: "ghost", size: "md" })}
        >
          Reset
        </Link>
      </form>

      <SectionCard
        title="Platform audit entries"
        description={`${data.total} entr${data.total === 1 ? "y" : "ies"} in this view.`}
        bodyClassName="p-0 sm:p-0"
      >
        {data.logs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.13em] text-muted">
                  <th scope="col" className="px-4 py-3 font-bold">
                    Action
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Actor
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    College
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Entity
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Metadata
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    When
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-line/70 align-top last:border-0 hover:bg-canvas/50"
                  >
                    <td className="px-4 py-4 text-[12px] font-bold text-ink">
                      {titleCase(log.action)}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[12px] font-semibold text-ink">{log.actor.name}</p>
                      <p className="mt-1 text-[11px] text-muted">{log.actor.email}</p>
                    </td>
                    <td className="px-4 py-4 text-[12px] text-ink-soft">
                      {log.college ? (
                        <Link
                          href={`/platform/colleges/${log.college.id}`}
                          className="font-semibold text-ink hover:text-forest"
                        >
                          {log.college.shortName ?? log.college.name}
                        </Link>
                      ) : (
                        "Platform"
                      )}
                    </td>
                    <td className="px-4 py-4 text-[12px] text-ink-soft">
                      <p>{log.entityType}</p>
                      <p className="mt-1 break-all text-[11px] text-muted">{log.entityId}</p>
                    </td>
                    <td className="max-w-[240px] px-4 py-4 text-[11px] leading-5 text-muted">
                      <code className="break-words">{JSON.stringify(log.metadata)}</code>
                    </td>
                    <td className="px-4 py-4 text-[12px] text-ink-soft">
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No audit entries match"
              description="Change the action filter to see more of the platform audit history."
            />
          </div>
        )}
      </SectionCard>

      {data.totalPages > 1 ? (
        <nav
          aria-label="Audit pagination"
          className="flex items-center justify-between gap-3 border-t border-line pt-5"
        >
          {data.page > 1 ? (
            <Link
              href={`/platform/audit-logs?${new URLSearchParams({ ...(action ? { action } : {}), page: String(data.page - 1) }).toString()}`}
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
              href={`/platform/audit-logs?${new URLSearchParams({ ...(action ? { action } : {}), page: String(data.page + 1) }).toString()}`}
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

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageHeader, MetricCard, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { SelectActionForm } from "@/features/dashboards/components/action-form";
import { changeCollegeStatusAction } from "@/features/dashboards/actions";
import { formatDateTime, titleCase } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getPlatformCollege } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Platform college detail",
  robots: { index: false, follow: false },
};

export default async function PlatformCollegePage({
  params,
}: {
  params: Promise<{ collegeId: string }>;
}) {
  const user = await requireDashboardRole("SUPER_ADMIN");
  const { collegeId } = await params;
  const college = await getPlatformCollege(user, collegeId);

  if (!college) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Tenant record"
        title={college.name}
        description="Inspect platform-level counts and change the college lifecycle. Suspending or archiving revokes every active session for the tenant."
        actions={
          <Link href="/platform/colleges" className={buttonStyles({ variant: "outline" })}>
            Back to colleges
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={college.status} />
          <span className="text-xs text-muted">{college.slug}</span>
          <span className="text-xs text-muted">Created {formatDateTime(college.createdAt)}</span>
        </div>
      </DashboardPageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Users" value={college._count.users} detail="Tenant accounts" />
        <MetricCard
          label="Clubs"
          value={college._count.clubs}
          detail="Tenant organizations"
          tone="forest"
        />
        <MetricCard
          label="Events"
          value={college._count.events}
          detail="Tenant event records"
          tone="signal"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <SectionCard title="College profile" description="Read-only tenant fields.">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Primary domain
                </dt>
                <dd className="mt-2 break-all text-sm font-semibold text-ink">
                  {college.primaryDomain ?? "Not set"}
                </dd>
              </div>
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Timezone
                </dt>
                <dd className="mt-2 text-sm font-semibold text-ink">{college.timezone}</dd>
              </div>
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Short name
                </dt>
                <dd className="mt-2 text-sm font-semibold text-ink">
                  {college.shortName ?? "Not set"}
                </dd>
              </div>
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Status
                </dt>
                <dd className="mt-2">
                  <StatusBadge status={college.status} />
                </dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard
            title="Recent users"
            description="The latest accounts in this tenant."
            bodyClassName="p-0 sm:p-0"
          >
            {college.users.length ? (
              <ul className="divide-y divide-line">
                {college.users.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5"
                  >
                    <div>
                      <p className="text-[12px] font-semibold text-ink">{member.name}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {member.email} · {titleCase(member.role)}
                      </p>
                    </div>
                    <StatusBadge status={member.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-muted">No users in this college.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Recent clubs"
            description="The latest organizations in this tenant."
            bodyClassName="p-0 sm:p-0"
          >
            {college.clubs.length ? (
              <ul className="divide-y divide-line">
                {college.clubs.map((club) => (
                  <li
                    key={club.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5"
                  >
                    <div>
                      <p className="text-[12px] font-semibold text-ink">{club.name}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        Created {formatDateTime(club.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={club.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-muted">No clubs in this college.</p>
            )}
          </SectionCard>
        </div>

        <aside className="space-y-6">
          <SectionCard
            title="Lifecycle status"
            description="Platform-only control. Session revocation is immediate."
          >
            <SelectActionForm
              action={changeCollegeStatusAction}
              fields={{ collegeId: college.id }}
              selectName="status"
              label="College status"
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "SUSPENDED", label: "Suspended" },
                { value: "ARCHIVED", label: "Archived" },
              ]}
              defaultValue={college.status}
              submitLabel="Update status"
            />
            <p className="mt-4 text-xs leading-5 text-muted">
              Suspending or archiving revokes all sessions for users in this college. Reactivating
              does not restore old sessions.
            </p>
          </SectionCard>

          <SectionCard
            title="Recent audit entries"
            description="Latest actions in this tenant."
            bodyClassName="p-0 sm:p-0"
          >
            {college.auditLogs.length ? (
              <ul className="divide-y divide-line">
                {college.auditLogs.map((log) => (
                  <li key={log.id} className="px-5 py-3.5">
                    <p className="text-[12px] font-semibold text-ink">{titleCase(log.action)}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {log.entityType} · {formatDateTime(log.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-muted">No audit activity in this college.</p>
            )}
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

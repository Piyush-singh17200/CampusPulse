import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { updateCollegeSettingsAction } from "@/features/dashboards/actions";
import { CollegeSettingsForm } from "@/features/dashboards/components/settings-forms";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getCollegeSettings } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "College settings",
  robots: { index: false, follow: false },
};

export default async function CollegeSettingsPage() {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const data = await getCollegeSettings(user);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Settings"
        title="College profile and boundaries."
        description="Update the public college identity and timezone. Tenant ownership, platform status, and billing fields are not editable from this dashboard."
        actions={
          <Link href="/college" className={buttonStyles({ variant: "outline" })}>
            Back to overview
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={data.college.status} />
          <span className="text-xs text-muted">
            Created {formatDateTime(data.college.createdAt)}
          </span>
        </div>
      </DashboardPageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <SectionCard
          title="College identity"
          description="Visible in dashboards and student-facing event pages."
        >
          <CollegeSettingsForm college={data.college} action={updateCollegeSettingsAction} />
        </SectionCard>

        <aside className="space-y-6">
          <SectionCard
            title="College record"
            description="Read-only fields from the trusted database record."
          >
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">Slug</dt>
                <dd className="text-right font-semibold text-ink">{data.college.slug}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">Primary domain</dt>
                <dd className="text-right font-semibold text-ink">
                  {data.college.primaryDomain ?? "Not set"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">Status</dt>
                <dd>
                  <StatusBadge status={data.college.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Created</dt>
                <dd className="text-right font-semibold text-ink">
                  {formatDateTime(data.college.createdAt)}
                </dd>
              </div>
            </dl>
          </SectionCard>
          <SectionCard title="Protected fields" description="Server-enforced boundaries.">
            <ul className="space-y-3 text-[13px] leading-6 text-muted">
              <li>Your college is read from the verified session, not the form.</li>
              <li>Platform status changes require a platform administrator.</li>
              <li>Timezone must be a valid IANA timezone.</li>
              <li>Every settings change is written to the college audit log.</li>
            </ul>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, MetricCard, SectionCard } from "@/components/dashboard/primitives";
import { buttonStyles } from "@/components/ui/button";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getPlatformSettings } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Platform settings",
  robots: { index: false, follow: false },
};

export default async function PlatformSettingsPage() {
  const user = await requireDashboardRole("SUPER_ADMIN");
  const data = await getPlatformSettings(user);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Settings"
        title="Platform boundaries and operational status."
        description="This dashboard does not expose secrets, environment values, or destructive platform controls. Tenant lifecycle changes happen on each college record."
        actions={
          <Link href="/platform/colleges" className={buttonStyles({ variant: "outline" })}>
            College directory
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Colleges" value={data.collegeCount} detail="Active database records" />
        <MetricCard label="Users" value={data.userCount} detail="Non-deleted accounts" />
        <MetricCard label="Clubs" value={data.clubCount} detail="Non-deleted clubs" />
        <MetricCard label="Events" value={data.eventCount} detail="Non-deleted events" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Operational status"
          description="Safe, non-secret configuration signals."
        >
          <dl className="space-y-4 text-[13px]">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <dt className="font-semibold text-ink">Email delivery</dt>
                <dd className="mt-1 text-xs text-muted">
                  Password-reset and notification email capability.
                </dd>
              </div>
              <span
                className={
                  data.emailEnabled
                    ? "text-sm font-bold text-forest"
                    : "text-sm font-bold text-signal-dark"
                }
              >
                {data.emailEnabled ? "Configured" : "Not configured"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <dt className="font-semibold text-ink">Object storage</dt>
                <dd className="mt-1 text-xs text-muted">
                  {data.storageDriver === "s3"
                    ? "Private S3-compatible poster storage."
                    : "Local poster storage for this instance."}
                </dd>
              </div>
              <span
                className={
                  data.storageConfigured
                    ? "text-sm font-bold text-forest"
                    : "text-sm font-bold text-signal-dark"
                }
              >
                {data.storageConfigured
                  ? data.storageDriver === "s3"
                    ? "S3 configured"
                    : "Local configured"
                  : "Not configured"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <dt className="font-semibold text-ink">Database</dt>
                <dd className="mt-1 text-xs text-muted">Counts are read live from PostgreSQL.</dd>
              </div>
              <span className="text-sm font-bold text-forest">Connected</span>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Security boundaries"
          description="What this dashboard deliberately does not do."
        >
          <ul className="space-y-3 text-[13px] leading-6 text-muted">
            <li>No secrets, SMTP credentials, or database URLs are rendered here.</li>
            <li>
              College suspension and archival require a separate explicit action with session
              revocation.
            </li>
            <li>Platform administrators cannot impersonate users from this dashboard.</li>
            <li>
              Every mutation is authenticated, authorized, validated, and audited server-side.
            </li>
            <li>Destructive database resets and bulk deletes are not exposed.</li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="Administrative model"
        description="How platform and college responsibilities are separated."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-line bg-canvas/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
              Platform
            </p>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              College lifecycle, cross-tenant user administration, platform analytics, and audit
              visibility.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-canvas/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">College</p>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              Event and club approvals, college user roles and status, analytics, audit history, and
              college settings.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-canvas/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
              Club and student
            </p>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              Scoped event operations and attendance, or discovery, registration, saved events,
              calendar, and profile management.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

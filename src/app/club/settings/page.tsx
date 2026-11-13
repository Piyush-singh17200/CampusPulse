import type { Metadata } from "next";
import Link from "next/link";

import { ClubSwitcher } from "@/components/dashboard/club-switcher";
import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { updateClubProfileAction } from "@/features/dashboards/actions";
import { ClubSettingsForm } from "@/features/dashboards/components/settings-forms";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getClubSettings } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Club settings",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClubSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const params = await searchParams;
  const clubId = typeof params.club === "string" ? params.club : undefined;
  const data = await getClubSettings(user, clubId);

  if (!data.club) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader eyebrow="Settings" title="No managed club found." />
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
        eyebrow="Settings"
        title="Club profile and boundaries."
        description="Update only the public club fields your role is permitted to manage. College ownership, approval status, and membership are server-controlled."
        actions={
          <Link
            href={`/club/events?club=${data.club.id}`}
            className={buttonStyles({ variant: "outline" })}
          >
            Back to events
          </Link>
        }
      >
        <ClubSwitcher clubs={data.clubs} activeClubId={data.club.id} path="/club/settings" />
      </DashboardPageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <SectionCard
          title="Public profile"
          description="Shown to students on event pages and club listings."
        >
          <ClubSettingsForm club={data.club} action={updateClubProfileAction} />
        </SectionCard>

        <aside className="space-y-6">
          <SectionCard title="Club record" description="Managed by your college.">
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">Status</dt>
                <dd>
                  <StatusBadge status={data.club.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">Slug</dt>
                <dd className="text-right font-semibold text-ink">{data.club.slug}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">Approved</dt>
                <dd className="text-right font-semibold text-ink">
                  {data.club.approvedAt ? formatDateTime(data.club.approvedAt) : "Not yet"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Created</dt>
                <dd className="text-right font-semibold text-ink">
                  {formatDateTime(data.club.createdAt)}
                </dd>
              </div>
            </dl>
          </SectionCard>
          <SectionCard
            title="What is protected"
            description="Security boundaries enforced on the server."
          >
            <ul className="space-y-3 text-[13px] leading-6 text-muted">
              <li>Only an active president or officer of this club can edit its profile.</li>
              <li>Your college is read from the verified session, never from the form.</li>
              <li>Club status and approval fields cannot be changed here.</li>
              <li>Every change is recorded in the college audit log.</li>
            </ul>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

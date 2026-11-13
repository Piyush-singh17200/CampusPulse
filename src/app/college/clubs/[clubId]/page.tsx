import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { ActionForm, ReasonActionForm } from "@/features/dashboards/components/action-form";
import { decideClubAction } from "@/features/dashboards/actions";
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getCollegeClub } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "College club detail",
  robots: { index: false, follow: false },
};

export default async function CollegeClubPage({ params }: { params: Promise<{ clubId: string }> }) {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const { clubId } = await params;
  const data = await getCollegeClub(user, clubId);

  if (!data) {
    notFound();
  }

  const { club } = data;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Club record"
        title={club.name}
        description={club.description ?? "Club profile, membership, and event history."}
        actions={
          <Link href="/college/clubs" className={buttonStyles({ variant: "outline" })}>
            Back to clubs
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={club.status} />
          <span className="text-xs text-muted">Created {formatDateTime(club.createdAt)}</span>
          {club.createdBy ? (
            <span className="text-xs text-muted">by {club.createdBy.name}</span>
          ) : null}
        </div>
      </DashboardPageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <SectionCard
            title="Club profile"
            description="The public record students see when browsing events."
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Status
                </dt>
                <dd className="mt-2">
                  <StatusBadge status={club.status} />
                </dd>
              </div>
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Slug
                </dt>
                <dd className="mt-2 text-sm font-semibold text-ink">{club.slug}</dd>
              </div>
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Approved
                </dt>
                <dd className="mt-2 text-sm font-semibold text-ink">
                  {club.approvedAt ? formatDateTime(club.approvedAt) : "Not yet"}
                </dd>
              </div>
              <div className="rounded-lg border border-line bg-canvas/60 p-4">
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  Status reason
                </dt>
                <dd className="mt-2 text-sm font-semibold text-ink">
                  {club.statusReason ?? "None"}
                </dd>
              </div>
            </dl>
            {club.description ? (
              <p className="mt-5 border-t border-line pt-5 text-[14px] leading-7 text-ink-soft">
                {club.description}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Membership"
            description="Active and inactive memberships for this club."
            bodyClassName="p-0 sm:p-0"
          >
            {club.memberships.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line text-[10px] uppercase tracking-[0.13em] text-muted">
                      <th scope="col" className="px-4 py-3 font-bold">
                        Member
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Club role
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Account role
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {club.memberships.map((membership) => (
                      <tr
                        key={membership.id}
                        className="border-b border-line/70 align-top last:border-0"
                      >
                        <td className="px-4 py-4">
                          <p className="text-[13px] font-bold text-ink">{membership.user.name}</p>
                          <p className="mt-1 text-[11px] text-muted">{membership.user.email}</p>
                        </td>
                        <td className="px-4 py-4 text-[12px] text-ink-soft">
                          {membership.role.toLowerCase().replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-4 text-[12px] text-ink-soft">
                          {membership.user.role.toLowerCase().replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={membership.status} />
                        </td>
                        <td className="px-4 py-4 text-[12px] text-ink-soft">
                          {formatDateTime(membership.joinedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-xs text-muted">No memberships recorded.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Recent events"
            description="The latest event records owned by this club."
            bodyClassName="p-0 sm:p-0"
          >
            {club.events.length ? (
              <ul className="divide-y divide-line">
                {club.events.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/college/events/${event.id}`}
                        className="block truncate text-[13px] font-semibold text-ink hover:text-forest"
                      >
                        {event.title}
                      </Link>
                      <p className="mt-1 text-[11px] text-muted">
                        {formatDateTime(event.startsAt)}
                      </p>
                    </div>
                    <StatusBadge status={event.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-muted">No events recorded for this club.</p>
            )}
          </SectionCard>
        </div>

        <aside className="space-y-6">
          <SectionCard
            title="Club decision"
            description="Only pending club applications can be decided."
          >
            {club.status === "PENDING" ? (
              <div className="space-y-5">
                <ActionForm
                  action={decideClubAction}
                  fields={{ clubId: club.id, decision: "APPROVE" }}
                  submitLabel="Approve club"
                  variant="signal"
                  size="md"
                />
                <div className="border-t border-line pt-5">
                  <ReasonActionForm
                    action={decideClubAction}
                    fields={{ clubId: club.id, decision: "REJECT" }}
                    label="Rejection reason"
                    placeholder="Explain what the club must address."
                    submitLabel="Reject club"
                    variant="outline"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">
                This club is {club.status.toLowerCase()}. The approval decision has already been
                recorded.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Membership totals" description="Server-derived counts.">
            <dl className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <dt className="text-muted">Members</dt>
                <dd className="font-bold text-ink">{club.memberships.length}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-3">
                <dt className="text-muted">Events</dt>
                <dd className="font-bold text-ink">{club.events.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Created</dt>
                <dd className="font-semibold text-ink">{formatDateTime(club.createdAt)}</dd>
              </div>
            </dl>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

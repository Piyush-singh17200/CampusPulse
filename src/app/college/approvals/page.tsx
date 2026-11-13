import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, MetricCard, SectionCard } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/ui/states";
import { ActionForm, ReasonActionForm } from "@/features/dashboards/components/action-form";
import { decideClubAction, transitionEventAction } from "@/features/dashboards/actions";
import { formatDateTime, titleCase } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getCollegeApprovals } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Approvals",
  robots: { index: false, follow: false },
};

export default async function CollegeApprovalsPage() {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const data = await getCollegeApprovals(user);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Approvals"
        title="Decisions that keep campus activity trustworthy."
        description="Review event submissions and new club applications. Rejections require a reason and every decision is audited."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Event approvals"
          value={data.pendingEvents.length}
          detail="Waiting for review"
          tone="signal"
        />
        <MetricCard
          label="Club applications"
          value={data.pendingClubs.length}
          detail="Waiting for a decision"
        />
        <MetricCard
          label="Recent decisions"
          value={data.recentlyDecided.length}
          detail="Latest audit entries"
          tone="forest"
        />
      </div>

      <div className="space-y-6">
        <SectionCard
          title="Pending events"
          description="Approve to publish immediately or reject with a clear reason."
          bodyClassName="p-0 sm:p-0"
        >
          {data.pendingEvents.length ? (
            <ul className="divide-y divide-line">
              {data.pendingEvents.map((event) => (
                <li
                  key={event.id}
                  className="grid gap-5 px-5 py-5 lg:grid-cols-[1fr_360px] lg:items-start"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={event.status} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                        {event.club.name}
                      </span>
                    </div>
                    <Link
                      href={`/college/events/${event.id}`}
                      className="mt-2 block text-[17px] font-bold tracking-[-0.02em] text-ink hover:text-forest"
                    >
                      {event.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {formatDateTime(event.startsAt)} ·{" "}
                      {event.isOnline ? "Online" : event.venueName}
                    </p>
                    {event.summary ? (
                      <p className="mt-3 text-[13px] leading-6 text-muted">{event.summary}</p>
                    ) : null}
                  </div>
                  <div className="space-y-4 rounded-lg border border-line bg-canvas/50 p-4">
                    <ActionForm
                      action={transitionEventAction}
                      fields={{ eventId: event.id, to: "PUBLISHED" }}
                      submitLabel="Approve"
                      variant="signal"
                    />
                    <ReasonActionForm
                      action={transitionEventAction}
                      fields={{ eventId: event.id, to: "REJECTED" }}
                      label="Rejection reason"
                      placeholder="What needs to change?"
                      submitLabel="Reject"
                      variant="outline"
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No event approvals waiting"
                description="Submitted events will appear here for review."
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Pending clubs"
          description="Approve new clubs or reject the application with a reason."
          bodyClassName="p-0 sm:p-0"
        >
          {data.pendingClubs.length ? (
            <ul className="divide-y divide-line">
              {data.pendingClubs.map((club) => (
                <li
                  key={club.id}
                  className="grid gap-5 px-5 py-5 lg:grid-cols-[1fr_360px] lg:items-start"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={club.status} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                        {club._count.memberships} member{club._count.memberships === 1 ? "" : "s"} ·{" "}
                        {club._count.events} event{club._count.events === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Link
                      href={`/college/clubs/${club.id}`}
                      className="mt-2 block text-[17px] font-bold tracking-[-0.02em] text-ink hover:text-forest"
                    >
                      {club.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      Submitted by {club.createdBy.name} · {formatDateTime(club.createdAt)}
                    </p>
                    {club.description ? (
                      <p className="mt-3 text-[13px] leading-6 text-muted">{club.description}</p>
                    ) : null}
                  </div>
                  <div className="space-y-4 rounded-lg border border-line bg-canvas/50 p-4">
                    <ActionForm
                      action={decideClubAction}
                      fields={{ clubId: club.id, decision: "APPROVE" }}
                      submitLabel="Approve club"
                      variant="signal"
                    />
                    <ReasonActionForm
                      action={decideClubAction}
                      fields={{ clubId: club.id, decision: "REJECT" }}
                      label="Rejection reason"
                      placeholder="What should the club address?"
                      submitLabel="Reject club"
                      variant="outline"
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No club applications waiting"
                description="New club applications will appear here for review."
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recently decided"
          description="The latest approval audit entries for this college."
          bodyClassName="p-0 sm:p-0"
        >
          {data.recentlyDecided.length ? (
            <ul className="divide-y divide-line">
              {data.recentlyDecided.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5"
                >
                  <div>
                    <p className="text-[12px] font-semibold text-ink">{titleCase(log.action)}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {log.actor.name} · {log.entityType} · {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={log.action.endsWith("APPROVED") ? "APPROVED" : "REJECTED"} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-xs text-muted">
              No approval decisions have been recorded yet.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import {
  BarList,
  DashboardPageHeader,
  MetricCard,
  SectionCard,
} from "@/components/dashboard/primitives";
import { buttonStyles } from "@/components/ui/button";
import { formatMonth } from "@/lib/format";
import { titleCase } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getCollegeAnalytics } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "College analytics",
  robots: { index: false, follow: false },
};

export default async function CollegeAnalyticsPage() {
  const user = await requireDashboardRole("COLLEGE_ADMIN");
  const data = await getCollegeAnalytics(user);

  const totalEvents = data.eventStatusCounts.reduce((sum, item) => sum + item.count, 0);
  const totalRegistrations = data.registrationStatusCounts.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const approved = data.approvalActivity.eventApproved + data.approvalActivity.clubApproved;
  const rejected = data.approvalActivity.eventRejected + data.approvalActivity.clubRejected;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Analytics"
        title="A factual view of campus activity."
        description="Every number on this page is derived from PostgreSQL records for your college. There are no estimated or decorative metrics."
        actions={
          <Link href="/college/events" className={buttonStyles({ variant: "outline" })}>
            Event register
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Events" value={totalEvents} detail="All-time records" />
        <MetricCard
          label="Registrations"
          value={totalRegistrations}
          detail="All-time activity"
          tone="forest"
        />
        <MetricCard
          label="Approvals"
          value={approved}
          detail="Events and clubs approved"
          tone="signal"
        />
        <MetricCard label="Rejections" value={rejected} detail="Events and clubs rejected" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Events by status" description="Current lifecycle distribution.">
          <BarList
            title="Event status"
            items={data.eventStatusCounts.map((item) => ({
              label: titleCase(item.status),
              value: item.count,
            }))}
            emptyLabel="No events yet."
          />
        </SectionCard>
        <SectionCard
          title="Registrations by status"
          description="Places, cancellations, and attendance."
        >
          <BarList
            title="Registration status"
            items={data.registrationStatusCounts.map((item) => ({
              label: titleCase(item.status),
              value: item.count,
            }))}
            emptyLabel="No registrations yet."
          />
        </SectionCard>
        <SectionCard title="Events by month" description="Start dates over the last six months.">
          <BarList
            title="Monthly events"
            items={data.eventMonths.map((item) => ({
              label: formatMonth(item.month),
              value: item.count,
            }))}
            emptyLabel="No events in this window."
          />
        </SectionCard>
        <SectionCard
          title="Registrations by month"
          description="Registration activity over the last six months."
        >
          <BarList
            title="Monthly registrations"
            items={data.registrationMonths.map((item) => ({
              label: formatMonth(item.month),
              value: item.count,
            }))}
            emptyLabel="No registrations in this window."
          />
        </SectionCard>
        <SectionCard title="Category mix" description="Events assigned to each category.">
          <BarList
            title="Categories"
            items={data.categoryBreakdown.map((item) => ({ label: item.name, value: item.count }))}
            emptyLabel="No categories assigned yet."
          />
        </SectionCard>
        <SectionCard
          title="Most active clubs"
          description="Events in the last six months, grouped by club."
        >
          <BarList
            title="Club activity"
            items={data.clubActivity.map((item) => ({ label: item.name, value: item.count }))}
            emptyLabel="No club activity in this window."
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Approval activity"
        description="Recorded decisions in the last six months."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Events approved"
            value={data.approvalActivity.eventApproved}
            detail="Published after review"
            tone="forest"
          />
          <MetricCard
            label="Events rejected"
            value={data.approvalActivity.eventRejected}
            detail="Returned to clubs"
            tone="signal"
          />
          <MetricCard
            label="Clubs approved"
            value={data.approvalActivity.clubApproved}
            detail="Activated"
          />
          <MetricCard
            label="Clubs rejected"
            value={data.approvalActivity.clubRejected}
            detail="Applications closed"
          />
        </div>
      </SectionCard>
    </div>
  );
}

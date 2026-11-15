import type { Metadata } from "next";
import Link from "next/link";

import { ClubSwitcher } from "@/components/dashboard/club-switcher";
import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { createEventAction } from "@/features/dashboards/actions";
import { EventForm } from "@/features/dashboards/components/event-form";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getClubEventFormOptions, getClubWorkspace } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Create event",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClubCreateEventPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("CLUB_ADMIN");
  const params = await searchParams;
  const clubId = typeof params.club === "string" ? params.club : undefined;
  const data = await getClubWorkspace(user, clubId);
  const options = await getClubEventFormOptions(user);

  if (!data.club) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader eyebrow="Create event" title="No managed club found." />
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
        eyebrow="Create event"
        title="Start with a clear draft."
        description="Save the essential details first. Drafts can be edited until you submit them for college approval."
        actions={
          <Link
            href={`/club/events?club=${data.club.id}`}
            className={buttonStyles({ variant: "outline" })}
          >
            Back to events
          </Link>
        }
      >
        <ClubSwitcher clubs={data.clubs} activeClubId={data.club.id} path="/club/events/create" />
      </DashboardPageHeader>

      {data.club.status !== "ACTIVE" ? (
        <EmptyState
          title="This club is not active"
          description="Only active clubs can create events. Ask your college administrator to review the club status."
        />
      ) : (
        <SectionCard
          title="Event details"
          description={`Creating for ${data.club.name}. All times use your college timezone.`}
        >
          <EventForm
            mode="create"
            clubId={data.club.id}
            categories={options.categories}
            interests={options.interests}
            action={createEventAction}
          />
        </SectionCard>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { DashboardEventCard } from "@/components/dashboard/event-card";
import { DashboardPageHeader } from "@/components/dashboard/primitives";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { unsaveEventAction } from "@/features/dashboards/actions";
import { ActionForm } from "@/features/dashboards/components/action-form";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getStudentSavedEvents } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Saved events",
  robots: { index: false, follow: false },
};

export default async function StudentSavedPage() {
  const user = await requireDashboardRole("STUDENT");
  const rows = await getStudentSavedEvents(user);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Saved"
        title="Your private shortlist."
        description="Saved events live in your CampusPulse account, so they are here when you return on another device."
        actions={
          <>
            <a href="/api/calendar/saved" className={buttonStyles({ variant: "outline" })}>
              Download saved events (.ics)
            </a>
            <Link href="/student/discover" className={buttonStyles({ variant: "outline" })}>
              Discover more
            </Link>
          </>
        }
      />

      {rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ event }) => (
            <DashboardEventCard
              key={event.id}
              event={event}
              href={`/student/events/${event.id}`}
              saved
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/student/events/${event.id}`}
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                  >
                    View
                  </Link>
                  <ActionForm
                    action={unsaveEventAction}
                    fields={{ eventId: event.id }}
                    submitLabel="Remove"
                    variant="ghost"
                    size="sm"
                    showMessage={false}
                  />
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing saved yet"
          description="Save events while you browse discovery. They will stay here until you remove them."
          action={
            <Link href="/student/discover" className={buttonStyles({ size: "sm" })}>
              Find an event
            </Link>
          }
        />
      )}
    </div>
  );
}

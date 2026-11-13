import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { updateStudentProfileAction } from "@/features/dashboards/actions";
import { StudentProfileForm } from "@/features/dashboards/components/student-profile-form";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getStudentProfile } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Student profile",
  robots: { index: false, follow: false },
};

export default async function StudentProfilePage() {
  const user = await requireDashboardRole("STUDENT");
  const context = await getStudentProfile(user);

  if (!context.profile || !context.college) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader
          eyebrow="Profile"
          title="Your student profile."
          description="A profile is required before you can register for events or save a shortlist."
        />
        <EmptyState
          title="Profile not available"
          description="Ask your college administrator to create or restore your student profile."
          action={
            <Link href="/account" className={buttonStyles({ variant: "outline" })}>
              Open account
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Profile"
        title="The details behind your dashboard."
        description="Update your student information and interests. Your role and college are managed by your administrator and cannot be changed here."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="forest">{context.college.name}</Badge>
          <Badge variant="outline">Student</Badge>
          <Badge variant="muted">{context.profile.user.email}</Badge>
        </div>
      </DashboardPageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <SectionCard
          title="Profile information"
          description="Visible to you and authorized college administrators."
        >
          <StudentProfileForm context={context} action={updateStudentProfileAction} />
        </SectionCard>

        <aside className="space-y-6">
          <SectionCard title="Account boundary" description="What you can and cannot change.">
            <ul className="space-y-3 text-[13px] leading-6 text-muted">
              <li>
                Your name, roll number, department, graduation year, bio, and interests can be
                edited here.
              </li>
              <li>
                Your email address is managed through account security and is not editable on this
                form.
              </li>
              <li>
                Your role, college ownership, and club membership are never accepted from the
                browser.
              </li>
            </ul>
            <Link
              href="/account"
              className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4" })}
            >
              Account security
            </Link>
          </SectionCard>
          <SectionCard
            title="Interests"
            description="Used for recommendations, not public ranking."
          >
            <p className="text-sm leading-6 text-muted">
              Recommendations are derived from the categories of events you have registered for and
              the interests you choose here. No third-party profiling is used.
            </p>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

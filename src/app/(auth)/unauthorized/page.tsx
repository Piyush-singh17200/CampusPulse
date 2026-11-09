import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

export default function UnauthorizedPage() {
  return (
    <AuthShell
      eyebrow="403 · Access denied"
      title="This area is not available to your account."
      description="Your session is valid, but your role or college scope does not permit this action."
      asideTitle="Clear boundaries keep every campus safe."
      asideDescription="CampusPulse checks permissions on the server for every action. If you believe you should have access, contact your college administrator."
    >
      <EmptyState
        title="You do not have permission"
        description="Return to your account or sign in with an account that has the right role and college access."
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/account" size="sm">
              Go to my account
            </ButtonLink>
            <ButtonLink href="/login" variant="outline" size="sm">
              Sign in again
            </ButtonLink>
          </div>
        }
      />
    </AuthShell>
  );
}

import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { logoutAction } from "@/features/auth/actions";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata: Metadata = {
  title: "Account unavailable",
  robots: { index: false, follow: false },
};

export default function AccountDisabledPage() {
  return (
    <AuthShell
      eyebrow="Account unavailable"
      title="Your account is not active."
      description="Sign-in and account actions are disabled for suspended or disabled accounts."
      asideTitle="Access can change. Your data stays protected."
      asideDescription="If your account status changed unexpectedly, contact your college administrator. They can review the account without exposing your password or session."
    >
      <EmptyState
        title="Contact your college administrator"
        description="Ask them to review your account status. If you are on a shared device, sign out before leaving."
        action={
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        }
      />
    </AuthShell>
  );
}

import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  return (
    <AuthShell
      eyebrow="Password recovery"
      title="Choose a new password."
      description="Use a strong password you have not used elsewhere. This will sign out every existing session."
      asideTitle="Fresh start. Same account."
      asideDescription="A reset link can be used once and expires quickly. Your existing sessions are revoked as soon as the new password is saved."
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <EmptyState
          title="This reset link is incomplete"
          description="The link is missing its reset token. Request a new password reset email to continue."
          action={
            <ButtonLink href="/forgot-password" size="sm">
              Request a new link
            </ButtonLink>
          }
        />
      )}
    </AuthShell>
  );
}

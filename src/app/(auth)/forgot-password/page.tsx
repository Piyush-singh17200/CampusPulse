import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Password recovery"
      title="Reset your password."
      description="Enter your account email and we will prepare a single-use reset link if the account exists."
      asideTitle="A way back in, without the guesswork."
      asideDescription="Password recovery is intentionally quiet: the same response whether or not an account exists, and no reset token is ever stored in plain text."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}

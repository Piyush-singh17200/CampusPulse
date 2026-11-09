import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

function getNotice(params: { [key: string]: string | string[] | undefined }): string | undefined {
  if (params.registered === "1") {
    return "Your account was created. Sign in to continue.";
  }

  if (params.loggedOut === "1") {
    return "You have been signed out.";
  }

  if (params.reset === "success") {
    return "Your password was updated. Sign in with your new password.";
  }

  return undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/account");
  }

  const params = await searchParams;

  return (
    <AuthShell
      eyebrow="Account access"
      title="Welcome back."
      description="Sign in with the email and password attached to your CampusPulse account."
      asideTitle="Pick up where your campus left off."
      asideDescription="Events, clubs, and the people who make them happen are waiting behind one secure sign-in."
    >
      <LoginForm notice={getNotice(params)} />
    </AuthShell>
  );
}

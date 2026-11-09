import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = {
  title: "Create a student account",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/account");
  }

  const colleges = await prisma.college.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, shortName: true },
  });

  return (
    <AuthShell
      eyebrow="Student registration"
      title="Find your people."
      description="Create a student account for your college. Your role is assigned securely on the server."
      asideTitle="A campus that feels connected."
      asideDescription="CampusPulse gives students one clear place to discover events, join the conversation, and show up for what matters."
    >
      <RegisterForm colleges={colleges} />
    </AuthShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { prisma } from "@/server/db/client";
import { requireAuthenticatedUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};

const roleLabels = {
  STUDENT: "Student",
  CLUB_ADMIN: "Club admin",
  COLLEGE_ADMIN: "College admin",
  SUPER_ADMIN: "Platform admin",
} as const;

export default async function AccountPage() {
  const user = await requireAuthenticatedUser();
  const college = user.collegeId
    ? await prisma.college.findUnique({
        where: { id: user.collegeId },
        select: { name: true, shortName: true },
      })
    : null;

  const sessionExpiry = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(user.sessionExpiresAt);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="forest">Active account</Badge>
          <h1 className="mt-4 font-display text-[2.8rem] leading-[0.98] tracking-[-0.03em] text-ink">
            Hello, {user.name.split(" ")[0] || "there"}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            This is your secure CampusPulse account home. Role-specific workspaces will be added in
            later phases.
          </p>
        </div>
        <ButtonLink href="/" variant="outline" size="sm">
          Back to home
        </ButtonLink>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-line bg-paper p-5 shadow-card">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Account</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-xs text-muted">Name</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Email</dt>
              <dd className="mt-1 break-all text-sm font-semibold text-ink">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Role</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{roleLabels[user.role]}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-line bg-paper p-5 shadow-card">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Session</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-xs text-muted">College</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">
                {college?.name ?? "Platform-wide access"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Session expires</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{sessionExpiry}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Security</dt>
              <dd className="mt-1 text-sm leading-6 text-ink-soft">
                Database-backed session with HttpOnly, SameSite cookie protection.
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-line bg-paper-dim/60 p-5">
        <h2 className="text-sm font-semibold text-ink">Keep your account secure</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-soft">
          <li>Use a unique password and never share it with anyone.</li>
          <li>Sign out when you finish on a shared device.</li>
          <li>
            Need to change your password?{" "}
            <Link
              href="/forgot-password"
              className="font-semibold text-forest underline-offset-4 hover:underline"
            >
              Request a reset link
            </Link>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}

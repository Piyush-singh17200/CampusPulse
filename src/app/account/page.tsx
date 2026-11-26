import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Bell, KeyRound, Monitor, Shield, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ActiveSessionsCard } from "@/features/auth/components/active-sessions-card";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { NotificationPreferenceForm } from "@/features/dashboards/components/notification-preference-form";
import { dashboardPathForRole } from "@/lib/roles";
import { prisma } from "@/server/db/client";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { getNotificationPreferences } from "@/services/notifications";

export const metadata: Metadata = {
  title: "Account Settings",
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

  let college: { name: string; shortName: string | null } | null = null;
  if (user.collegeId) {
    try {
      college = await prisma.college.findUnique({
        where: { id: user.collegeId },
        select: { name: true, shortName: true },
      });
    } catch (error) {
      console.error("Failed to load college details for account:", error);
    }
  }

  // Load active sessions from the database
  const rawSessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      ipAddress: true,
      userAgent: true,
    },
  });

  const sessions = rawSessions.map((s) => ({
    ...s,
    isCurrent: s.id === user.sessionId,
  }));

  // Load notification preferences
  const notificationPreferences = await getNotificationPreferences(user);

  const sessionExpiry = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(user.sessionExpiresAt);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="forest">Active account</Badge>
            <Badge variant="outline">{roleLabels[user.role]}</Badge>
          </div>
          <h1 className="mt-3 font-display text-[2.6rem] leading-[1] tracking-[-0.03em] text-ink">
            Account & Settings
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Manage your personal profile, credentials, security sessions, and preferences across
            CampusPulse.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ButtonLink href={dashboardPathForRole(user.role)} variant="primary" size="sm">
            Open role workspace
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </ButtonLink>
          <ButtonLink href="/" variant="outline" size="sm">
            Back to home
          </ButtonLink>
        </div>
      </div>

      {/* Account & Profile Summary */}
      <section className="rounded-xl border border-line bg-paper p-6 shadow-card">
        <div className="flex items-center gap-2 border-b border-line pb-4">
          <UserRound className="size-4 text-forest" aria-hidden="true" />
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Profile & Tenant
          </h2>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-muted">Full name</dt>
            <dd className="mt-1 text-sm font-bold text-ink">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Email address</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5 break-all text-sm font-semibold text-ink">
              <span>{user.email}</span>
              {user.emailVerified ? (
                <Badge variant="forest" className="text-[10px] py-0 px-1.5">
                  Verified
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-signal/40 text-[10px] py-0 px-1.5 text-signal-dark dark:text-signal"
                >
                  Unverified
                </Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Assigned role</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">{roleLabels[user.role]}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">College tenant</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {college?.name ?? "Platform-wide access"}
            </dd>
          </div>
        </div>
        {user.role === "STUDENT" ? (
          <div className="mt-5 border-t border-line pt-4 text-xs text-muted">
            Need to update department, graduation year, or interests?{" "}
            <Link
              href="/student/profile"
              className="font-bold text-forest underline decoration-forest underline-offset-4 hover:text-signal-dark"
            >
              Edit student profile →
            </Link>
          </div>
        ) : null}
      </section>

      {/* Password & Security */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-line bg-paper p-6 shadow-card">
          <div className="flex items-center gap-2 border-b border-line pb-4">
            <KeyRound className="size-4 text-forest" aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Change Password
            </h2>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            Update your account password securely. Changing your password uses Argon2id encryption.
          </p>
          <div className="mt-5">
            <ChangePasswordForm />
          </div>
        </section>

        {/* Appearance & Themes */}
        <section className="rounded-xl border border-line bg-paper p-6 shadow-card">
          <div className="flex items-center gap-2 border-b border-line pb-4">
            <Monitor className="size-4 text-forest" aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Appearance</h2>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            Choose your preferred theme. Your choice is saved locally and applies across all
            dashboards.
          </p>
          <div className="mt-5">
            <ThemeToggle />
          </div>

          <div className="mt-8 border-t border-line pt-5">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-forest" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Current Session
              </h3>
            </div>
            <dl className="mt-3 space-y-2 text-xs text-muted">
              <div className="flex justify-between">
                <span>Expires:</span>
                <span className="font-semibold text-ink">{sessionExpiry}</span>
              </div>
              <div className="flex justify-between">
                <span>Protection:</span>
                <span className="font-semibold text-ink">HttpOnly, SameSite Lax</span>
              </div>
            </dl>
          </div>
        </section>
      </div>

      {/* Active Sessions */}
      <section className="rounded-xl border border-line bg-paper p-6 shadow-card">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-forest" aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Active Sessions ({sessions.length})
            </h2>
          </div>
          <span className="text-xs text-muted">Database-verified sessions</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          Devices and browsers that currently hold a valid session token for your account. You can
          revoke any remote session at any time.
        </p>
        <div className="mt-5">
          <ActiveSessionsCard sessions={sessions} />
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="rounded-xl border border-line bg-paper p-6 shadow-card">
        <div className="flex items-center gap-2 border-b border-line pb-4">
          <Bell className="size-4 text-forest" aria-hidden="true" />
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            In-App Notifications
          </h2>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          Control which categories of in-app activity notifications are generated for your account.
        </p>
        <div className="mt-5">
          <NotificationPreferenceForm initial={notificationPreferences} />
        </div>
      </section>

      {/* Privacy & Account Boundaries */}
      <section className="rounded-xl border border-line bg-paper-dim/60 p-6">
        <h2 className="text-sm font-semibold text-ink">Privacy & Security Policies</h2>
        <ul className="mt-3 space-y-2 text-xs leading-6 text-muted">
          <li>
            • <strong>Tenant Data Isolation:</strong> Your registrations, attendance records, and
            feedback are strictly partitioned to your college tenant.
          </li>
          <li>
            • <strong>No Unencrypted Passwords:</strong> Credentials are never stored or logged in
            plaintext. We use modern Argon2id password hashing.
          </li>
          <li>
            • <strong>No Secret Tracking:</strong> CampusPulse does not use external tracking or
            advertising cookies.
          </li>
          <li>
            • <strong>Forgotten Password:</strong> If you forget your password, you can request a
            secure reset link from the{" "}
            <Link
              href="/forgot-password"
              className="font-bold text-forest underline decoration-forest underline-offset-4 hover:text-signal-dark"
            >
              Password Reset Page
            </Link>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}

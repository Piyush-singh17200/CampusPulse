import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SkipLink } from "@/components/ui/skip-link";
import { logoutAction } from "@/features/auth/actions";
import { siteConfig } from "@/config/site";
import { auth } from "@/server/auth/auth";
import { getCurrentUser } from "@/server/auth/session";

const roleLabels = {
  STUDENT: "Student",
  CLUB_ADMIN: "Club admin",
  COLLEGE_ADMIN: "College admin",
  SUPER_ADMIN: "Platform admin",
} as const;

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    let hasSession = false;

    try {
      const session = await auth.api.getSession({
        headers: await headers(),
        query: { disableCookieCache: true },
      });
      hasSession = Boolean(session?.user);
    } catch {
      hasSession = false;
    }

    redirect(hasSession ? "/account-disabled" : "/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SkipLink />
      <header className="border-b border-line/80 bg-canvas/90 backdrop-blur-md">
        <Container className="flex h-[4.5rem] items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
            aria-label={`${siteConfig.name} home`}
          >
            <BrandMark className="size-8 text-ink" />
            <span className="text-[15px] font-bold leading-none tracking-[-0.03em] text-ink">
              {siteConfig.name}
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Badge variant="outline">{roleLabels[user.role]}</Badge>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </Container>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <Container className="py-10 sm:py-14">{children}</Container>
      </main>

      <footer className="border-t border-line">
        <Container className="py-5 text-[11px] text-muted">
          Your session is verified on the server for every request.
        </Container>
      </footer>
    </div>
  );
}

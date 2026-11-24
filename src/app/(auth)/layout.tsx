import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SkipLink } from "@/components/ui/skip-link";
import { siteConfig } from "@/config/site";

export default function AuthLayout({ children }: { children: ReactNode }) {
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
            <span className="flex flex-col">
              <span className="text-[15px] font-bold leading-none tracking-[-0.03em] text-ink">
                {siteConfig.name}
              </span>
              <span className="mt-1 hidden text-[8px] font-bold uppercase leading-none tracking-[0.16em] text-muted sm:block">
                Campus event infrastructure
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            <ButtonLink href="/login" variant="ghost" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register" size="sm">
              Create account
            </ButtonLink>
          </div>
        </Container>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>

      <footer className="border-t border-line bg-canvas">
        <Container className="flex flex-col gap-2 py-5 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. A calmer campus operating system.
          </p>
          <p>Secure account access · Server-verified permissions</p>
        </Container>
      </footer>
    </div>
  );
}

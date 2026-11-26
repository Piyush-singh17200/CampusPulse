import { ArrowUpRight, Check } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import type { UserRole } from "@/generated/prisma/enums";
import { ROLE_LABELS, dashboardPathForRole } from "@/lib/roles";

export type CtaSectionProps = {
  user?: {
    name: string;
    role: UserRole;
  } | null;
};

export function CtaSection({ user }: CtaSectionProps = {}) {
  return (
    <section className="border-b border-ink/10 bg-signal py-16 text-ink sm:py-20 lg:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/65">
              The complete campus loop
            </p>
            <h2 className="mt-5 max-w-[15ch] text-balance font-display text-[clamp(2.8rem,6vw,5.6rem)] leading-[0.88] tracking-[-0.04em]">
              Your campus already has a pulse.
              <span className="block italic">Give it a clear signal.</span>
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-ink/75">
              Discovery, publishing, moderation, attendance, feedback, and reporting are connected
              in one working product. Start with the student experience, then explore the role
              workspaces that keep a campus moving.
            </p>
          </div>

          <div className="border-t border-ink/25 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">
              Start here
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              {user ? (
                <>
                  <ButtonLink
                    href={dashboardPathForRole(user.role)}
                    variant="primary"
                    size="lg"
                    className="justify-between bg-ink text-paper hover:bg-ink-soft"
                  >
                    Open your {ROLE_LABELS[user.role]} workspace
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </ButtonLink>
                  <ButtonLink
                    href="/account"
                    variant="outline"
                    size="lg"
                    className="justify-between border-ink/30 text-ink hover:border-ink hover:bg-ink/10"
                  >
                    Manage your account
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </ButtonLink>
                </>
              ) : (
                <>
                  <ButtonLink
                    href="/register"
                    variant="primary"
                    size="lg"
                    className="justify-between bg-ink text-paper hover:bg-ink-soft"
                  >
                    Create a student account
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </ButtonLink>
                  <ButtonLink
                    href="/login"
                    variant="outline"
                    size="lg"
                    className="justify-between border-ink/30 text-ink hover:border-ink hover:bg-ink/10"
                  >
                    Sign in to a workspace
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </ButtonLink>
                </>
              )}
            </div>
            <ul className="mt-5 space-y-2 text-[11px] font-medium text-ink/65">
              {[
                "Role-scoped access by default",
                "Moderated by college teams",
                "Database-backed, not a static mockup",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check aria-hidden="true" className="size-3.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

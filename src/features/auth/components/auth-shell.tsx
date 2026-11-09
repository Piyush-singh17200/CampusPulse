import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  asideTitle?: string;
  asideDescription?: string;
};

const trustPoints = [
  "Server-verified sessions, never browser-supplied roles.",
  "Your college community, kept inside its own boundary.",
  "Clear controls for students, clubs, and administrators.",
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  asideTitle = "The campus, in one pulse.",
  asideDescription = "CampusPulse gives every college a calm, reliable place to discover what is happening and who is making it happen.",
}: AuthShellProps) {
  return (
    <div className="relative overflow-hidden">
      <div aria-hidden="true" className="section-grid absolute inset-0 opacity-40" />
      <Container className="relative grid min-h-[calc(100vh-11rem)] items-center gap-10 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-16">
        <section className="hidden max-w-xl lg:block">
          <Badge variant="outline">
            <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
            {eyebrow}
          </Badge>
          <h1 className="mt-6 font-display text-[clamp(2.8rem,5vw,4.8rem)] leading-[0.96] tracking-[-0.03em] text-ink">
            {asideTitle}
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-muted">{asideDescription}</p>

          <div className="mt-10 rounded-2xl border border-line bg-paper/70 p-6 shadow-card">
            <div className="flex items-center gap-3">
              <BrandMark className="size-10 text-ink" />
              <div>
                <p className="text-sm font-bold tracking-[-0.02em] text-ink">CampusPulse</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                  Campus event infrastructure
                </p>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {trustPoints.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-6 text-ink-soft">
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-forest"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[31rem]">
          <div className="rounded-2xl border border-line bg-paper p-6 shadow-card sm:p-8">
            <Badge variant="signal">{eyebrow}</Badge>
            <h2 className="mt-5 font-display text-[2.15rem] leading-[1.02] tracking-[-0.025em] text-ink">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
            <div className="mt-7">{children}</div>
          </div>
          <p className="mt-5 text-center text-[11px] leading-5 text-muted">
            CampusPulse protects your account with server-side sessions and secure password
            handling.
          </p>
        </section>
      </Container>
    </div>
  );
}

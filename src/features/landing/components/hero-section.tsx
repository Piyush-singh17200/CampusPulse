import { ArrowDown, ArrowUpRight, Check, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EventCard } from "@/components/ui/event-card";
import { previewEvents } from "@/features/landing/data/preview-events";

const assurances = ["College-scoped by design", "Moderated publishing", "Student-first discovery"];

function HeroBoard() {
  return (
    <div className="relative">
      <div className="absolute -left-5 top-16 hidden h-28 w-px bg-line-strong lg:block" />
      <div className="absolute -left-5 top-16 hidden size-2 -translate-x-[3.5px] rounded-full bg-signal lg:block" />

      <div
        className="relative overflow-hidden rounded-xl border border-line bg-paper shadow-float"
        aria-label="CampusPulse discovery preview with fictional sample events"
      >
        <div className="flex items-center justify-between gap-4 border-b border-line bg-ink px-4 py-3.5 text-paper sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="signal-bars flex h-5 items-end gap-[3px]" aria-hidden="true">
              <span className="h-2 w-[3px] rounded-full bg-signal" />
              <span className="h-4 w-[3px] rounded-full bg-signal" />
              <span className="h-3 w-[3px] rounded-full bg-signal" />
              <span className="h-5 w-[3px] rounded-full bg-signal" />
              <span className="h-3.5 w-[3px] rounded-full bg-signal" />
              <span className="h-[18px] w-[3px] rounded-full bg-signal" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">CampusPulse</span>
          </div>
          <span className="text-[10px] font-medium text-paper/55">Northfield University</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-canvas/45 px-4 py-4 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest">
              This week
            </p>
            <p className="mt-1 font-display text-2xl leading-none tracking-[-0.02em]">
              What&apos;s worth showing up for.
            </p>
          </div>
          <Badge variant="outline">Sample preview</Badge>
        </div>

        <div className="space-y-2.5 p-4 sm:p-5">
          {previewEvents.slice(0, 3).map((event) => (
            <EventCard key={event.id} event={event} variant="compact" />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas/45 px-4 py-3 sm:px-5">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted">
            <Sparkles aria-hidden="true" className="size-3.5 text-signal-dark" />
            Built around your interests and your week
          </span>
          <ArrowUpRight aria-hidden="true" className="size-4 text-forest" />
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-line bg-canvas">
      <div className="section-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute -right-24 top-10 size-[32rem] rounded-full border border-line/70" />
      <div className="pointer-events-none absolute -right-10 top-32 size-[18rem] rounded-full border border-line/70" />

      <Container className="relative grid gap-14 py-14 sm:py-20 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:gap-16 lg:py-24">
        <div className="animate-rise">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">
              <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
              Product preview
            </Badge>
            <span className="text-[11px] font-medium text-muted">
              Built for multi-college campuses
            </span>
          </div>

          <h1 className="mt-6 max-w-[13ch] text-balance font-display text-[clamp(3.6rem,8.8vw,7.2rem)] leading-[0.86] tracking-[-0.045em] text-ink">
            The whole campus,
            <span className="mt-1 block italic text-forest">in one clear view.</span>
          </h1>

          <p className="mt-7 max-w-xl text-[15px] leading-7 text-muted sm:text-base">
            CampusPulse is the shared discovery layer for college life. Students find events that
            fit their interests. Clubs publish with less friction. Administrators see the whole
            picture — without chasing scattered updates.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#preview" size="lg">
              Explore the product preview
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </ButtonLink>
            <ButtonLink href="#how-it-works" variant="outline" size="lg">
              See how it works
              <ArrowDown aria-hidden="true" className="size-4" />
            </ButtonLink>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5">
            {assurances.map((item) => (
              <li
                key={item}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted"
              >
                <Check aria-hidden="true" className="size-3.5 text-forest" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-rise [animation-delay:120ms]">
          <HeroBoard />
        </div>
      </Container>
    </section>
  );
}

import { ArrowUpRight, Check } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function CtaSection() {
  return (
    <section className="border-b border-ink/10 bg-signal py-16 text-ink sm:py-20 lg:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/65">
              The campus operating layer
            </p>
            <h2 className="mt-5 max-w-[15ch] text-balance font-display text-[clamp(2.8rem,6vw,5.6rem)] leading-[0.88] tracking-[-0.04em]">
              Bring your campus
              <span className="block italic">into focus.</span>
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-ink/75">
              CampusPulse starts with a reliable foundation: a real data model, explicit event
              integrity, and a design language that can scale from a student feed to a college
              operations desk.
            </p>
          </div>

          <div className="border-t border-ink/25 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">
              Product preview
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              <ButtonLink
                href="#preview"
                variant="primary"
                size="lg"
                className="justify-between bg-ink text-paper hover:bg-ink-soft"
              >
                Explore the discovery preview
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </ButtonLink>
              <ButtonLink
                href="#platform"
                variant="outline"
                size="lg"
                className="justify-between border-ink/30 text-ink hover:border-ink hover:bg-ink/10"
              >
                Review the platform
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </ButtonLink>
            </div>
            <ul className="mt-5 space-y-2 text-[11px] font-medium text-ink/65">
              {[
                "No account required for the preview",
                "Fictional sample data, clearly labelled",
                "Built for multi-college operations",
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

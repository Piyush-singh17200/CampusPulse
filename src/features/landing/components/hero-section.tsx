import { ArrowDown, ArrowUpRight, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ProductPreview } from "@/features/landing/components/product-preview";

const assurances = ["College-scoped access", "Moderated publishing", "Four connected roles"];

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-line bg-canvas">
      <div className="section-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -right-24 top-10 size-[32rem] rounded-full border border-line/70" />
      <div className="pointer-events-none absolute -right-10 top-32 size-[18rem] rounded-full border border-line/70" />

      <Container className="relative grid gap-12 py-12 sm:py-16 lg:grid-cols-[0.93fr_1.07fr] lg:items-center lg:gap-14 lg:py-20 xl:gap-20">
        <div className="min-w-0 animate-rise">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">
              <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
              Working product
            </Badge>
            <span className="text-[11px] font-medium text-muted">
              Four role-based workspaces, one campus record
            </span>
          </div>

          <p className="mt-7 text-[11px] font-bold tracking-[0.08em] text-forest">
            CampusPulse — Too Many Posters, Too Little Signal.
          </p>

          <h1 className="mt-3 max-w-[12ch] text-balance font-display text-[clamp(3.35rem,8vw,6.8rem)] leading-[0.87] tracking-[-0.045em] text-ink">
            Too many posters.
            <span className="mt-1 block italic text-forest">Too little signal.</span>
          </h1>

          <p className="mt-7 max-w-xl text-[15px] leading-7 text-muted sm:text-base">
            CampusPulse turns scattered posters, group chats, and forms into one moderated campus
            feed. Students find what fits their week. Clubs run the whole event. Colleges see every
            decision. Platform admins keep the network accountable.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/register" size="lg">
              Find your next event
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </ButtonLink>
            <ButtonLink href="#platform" variant="outline" size="lg">
              See the platform
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

          <p className="mt-6 border-t border-line pt-4 text-[11px] leading-5 text-muted">
            Already have a campus account?{" "}
            <a
              href="/login"
              className="font-bold text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:text-forest"
            >
              Sign in to your workspace
            </a>
            .
          </p>
        </div>

        <div className="min-w-0 animate-rise [animation-delay:120ms]">
          <ProductPreview />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] leading-4 text-muted">
            <span>Switch roles above. The preview uses illustrative data.</span>
            <span className="font-semibold text-forest">Every signed-in view is live.</span>
          </div>
        </div>
      </Container>
    </section>
  );
}

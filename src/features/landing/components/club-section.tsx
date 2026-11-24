import { ArrowUpRight, Check, ScanText, Send, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const clubFeatures = [
  {
    icon: Send,
    title: "One structured publish",
    description:
      "Capture the event once — title, venue, timing, eligibility, capacity, and registration — then move it through a clear review path.",
  },
  {
    icon: ScanText,
    title: "Poster review, not poster chaos",
    description:
      "Poster uploads become an OCR-assisted draft, so clubs spend less time retyping details from their own designs.",
  },
  {
    icon: ShieldCheck,
    title: "Fewer collisions",
    description:
      "Duplicate and conflict checks run before publishing, giving clubs and colleges a shared source of truth.",
  },
];

const lifecycle = [
  { label: "Draft", done: true },
  { label: "In review", done: true },
  { label: "Published", done: true, current: true },
  { label: "Complete", done: false },
];

function ClubPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-float">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-ink px-5 py-4 text-paper">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/55">
            Club view / sample
          </p>
          <p className="mt-1 font-display text-2xl leading-none tracking-[-0.02em]">
            Event control room
          </p>
        </div>
        <Badge variant="dark">Design Collective</Badge>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
              Published event
            </p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
              Design Critique Night
            </p>
            <p className="mt-1 text-xs text-muted">Tue, 17 Nov · 7:00 PM · Studio 2</p>
          </div>
          <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-success">
            Live
          </span>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Event lifecycle
          </p>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {lifecycle.map((step) => (
              <div key={step.label}>
                <div
                  className={`h-1 rounded-full ${
                    step.current ? "bg-signal" : step.done ? "bg-forest" : "bg-line"
                  }`}
                />
                <p
                  className={`mt-2 text-[9px] font-bold uppercase leading-3 tracking-[0.08em] ${
                    step.current ? "text-signal-dark" : step.done ? "text-forest" : "text-muted"
                  }`}
                >
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-canvas/45 p-3">
            <div className="flex items-center gap-2">
              <ScanText aria-hidden="true" className="size-3.5 text-forest" />
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
                Poster review
              </p>
            </div>
            <p className="mt-2 text-xs font-semibold text-ink">Draft details extracted</p>
            <p className="mt-1 text-[10px] leading-4 text-muted">
              Ready for a club admin to confirm.
            </p>
          </div>
          <div className="rounded-md border border-line bg-canvas/45 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-3.5 text-forest" />
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
                Pre-flight checks
              </p>
            </div>
            <p className="mt-2 text-xs font-semibold text-ink">No duplicate found</p>
            <p className="mt-1 text-[10px] leading-4 text-muted">Date and venue are clear.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-forest px-3 py-2.5 text-paper">
          <div className="flex items-center gap-2">
            <Check aria-hidden="true" className="size-3.5 text-signal" />
            <span className="text-[10px] font-semibold">Registration is open</span>
          </div>
          <span className="text-[9px] font-medium text-paper/60">Closes 15 Nov</span>
        </div>
      </div>
    </div>
  );
}

export function ClubSection() {
  return (
    <section id="clubs" className="border-b border-line bg-sage py-16 sm:py-20 lg:py-28">
      <Container className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
        <div className="order-2 lg:order-1">
          <ClubPreview />
          <p className="mt-4 text-[10px] font-medium text-muted">
            Fictional club and event data for interface preview only.
          </p>
        </div>

        <div className="order-1 lg:order-2">
          <SectionHeading
            eyebrow="For clubs"
            title={
              <>
                From a draft
                <span className="italic text-forest"> to a room full of people.</span>
              </>
            }
            description="Clubs should spend their energy on the event, not on chasing approvals or copying details into three different places. CampusPulse gives every event a clear path."
          />

          <div className="mt-9 border-t border-line-strong">
            {clubFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="grid gap-3 border-b border-line py-5 sm:grid-cols-[2rem_1fr]"
                >
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 size-4 text-forest"
                    strokeWidth={1.7}
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <a
            href="#how-it-works"
            className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-ink transition-colors hover:text-forest"
          >
            Follow the publishing flow
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      </Container>
    </section>
  );
}

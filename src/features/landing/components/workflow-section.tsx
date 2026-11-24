import { ArrowRight, CheckCircle2, ClipboardCheck, Compass, LineChart } from "lucide-react";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const steps = [
  {
    number: "01",
    icon: ClipboardCheck,
    title: "Clubs publish once",
    description:
      "A structured draft captures the date, venue, eligibility, capacity, and registration details in one place.",
  },
  {
    number: "02",
    icon: CheckCircle2,
    title: "The campus reviews",
    description:
      "College teams approve, request changes, or catch duplicates before an event reaches the student feed.",
  },
  {
    number: "03",
    icon: Compass,
    title: "Students discover",
    description:
      "The right events surface with context: why they fit, when they happen, and what to do next.",
  },
  {
    number: "04",
    icon: LineChart,
    title: "Everyone learns",
    description:
      "Registration and attendance signals help clubs improve and colleges plan a better campus calendar.",
  },
];

export function WorkflowSection() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-ink py-16 text-paper sm:py-20 lg:py-28"
    >
      <div className="section-grid-dark pointer-events-none absolute inset-0 opacity-60" />
      <Container className="relative">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow="How it works"
            tone="dark"
            title={
              <>
                A shared workflow,
                <span className="italic text-signal"> not another inbox.</span>
              </>
            }
            description="CampusPulse connects the people who create campus events with the people who need to find them. Every handoff stays visible."
          />
          <p className="max-w-xs border-l border-paper/20 pl-5 text-xs leading-6 text-paper/55 lg:mb-1">
            The lifecycle is explicit: draft, review, publish, cancel, or complete. No silent state
            changes.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-paper/15 bg-paper/15 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <article key={step.number} className="relative bg-ink p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold tracking-[0.18em] text-signal">
                    {step.number}
                  </span>
                  <Icon aria-hidden="true" className="size-5 text-paper/50" strokeWidth={1.5} />
                </div>
                <h3 className="mt-10 font-display text-[1.65rem] leading-none tracking-[-0.02em] text-paper">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-paper/55">{step.description}</p>
                {step.number !== "04" ? (
                  <ArrowRight
                    aria-hidden="true"
                    className="mt-7 size-4 text-signal/80"
                    strokeWidth={1.5}
                  />
                ) : (
                  <span className="mt-7 block h-4 w-4 rounded-full border border-signal/60" />
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-6 flex flex-wrap items-center gap-2 text-[11px] font-medium text-paper/45">
          <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
          Designed for multi-college operations. Every sensitive action leaves an audit record.
        </p>
      </Container>
    </section>
  );
}

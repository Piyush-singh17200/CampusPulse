import { ArrowDownRight } from "lucide-react";

import { Container } from "@/components/ui/container";

const problems = [
  {
    number: "01",
    title: "Events live everywhere",
    description:
      "Posters, group chats, PDFs, social posts, and word of mouth all describe the same campus differently. Students miss things that were never in their feed.",
  },
  {
    number: "02",
    title: "Context gets lost",
    description:
      "A date, a venue, an eligibility note, and a registration link are often spread across four places. Finding an event is only half the work.",
  },
  {
    number: "03",
    title: "Coordination is manual",
    description:
      "Clubs chase approvals and attendance lists while administrators lack a reliable view of what is happening across campus.",
  },
];

export function ProblemSection() {
  return (
    <section id="problem" className="border-b border-line bg-paper py-16 sm:py-20 lg:py-28">
      <Container className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-forest">
            <span className="h-px w-7 bg-forest/40" />
            The problem
          </p>
          <h2 className="mt-5 max-w-[12ch] text-balance font-display text-[clamp(2.8rem,5.6vw,5rem)] leading-[0.92] tracking-[-0.03em] text-ink">
            The events exist.
            <span className="block italic text-signal-dark">The signal doesn&apos;t.</span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-muted">
            Campus life is already full of things worth showing up for. The hard part is making them
            visible, understandable, and easy to act on across an entire college community.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 border-t border-line pt-4 text-xs font-semibold text-ink">
            <ArrowDownRight aria-hidden="true" className="size-4 text-signal-dark" />
            CampusPulse closes the distance between them.
          </div>
        </div>

        <div className="border-t border-line-strong">
          {problems.map((problem) => (
            <article
              key={problem.number}
              className="grid gap-4 border-b border-line py-7 sm:grid-cols-[3rem_1fr] sm:gap-7 sm:py-8"
            >
              <span className="text-[11px] font-bold tracking-[0.16em] text-signal-dark">
                {problem.number}
              </span>
              <div>
                <h3 className="font-display text-[1.8rem] leading-none tracking-[-0.02em] text-ink">
                  {problem.title}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-muted">{problem.description}</p>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

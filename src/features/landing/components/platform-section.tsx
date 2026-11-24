import { ChartNoAxesCombined, Compass, Send, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/cn";

type Capability = {
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
  note: string;
  dark?: boolean;
};

const capabilities: Capability[] = [
  {
    number: "01",
    icon: Compass,
    title: "Discovery with context",
    description:
      "A student feed shaped by interests, timing, and campus relevance — with the details needed to decide, not just a poster and a date.",
    note: "Personalized feed · saved events · calendar",
  },
  {
    number: "02",
    icon: Send,
    title: "Publishing with structure",
    description:
      "Clubs publish once through a clear event workflow. Dates, venues, eligibility, capacity, and registration details stay together.",
    note: "Event lifecycle · poster review · registration",
  },
  {
    number: "03",
    icon: ShieldCheck,
    title: "Moderation with a record",
    description:
      "College teams get approval queues, duplicate review, and an audit trail for sensitive administrative actions.",
    note: "Tenant-scoped · audited · reviewable",
    dark: true,
  },
  {
    number: "04",
    icon: ChartNoAxesCombined,
    title: "Intelligence that compounds",
    description:
      "A campus-wide view of what students attend, what clubs run, and where the next programme should focus.",
    note: "Participation signals · event analytics",
  },
];

export function PlatformSection() {
  return (
    <section id="platform" className="border-b border-line bg-canvas py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow="Platform"
            title={
              <>
                One place to discover,
                <span className="italic text-forest"> coordinate, and learn.</span>
              </>
            }
            description="CampusPulse connects discovery, publishing, moderation, and reporting in one product. Each workspace is shaped by real permissions rather than a shared admin screen."
          />
          <p className="max-w-xs border-l border-line-strong pl-5 text-xs leading-6 text-muted lg:mb-1">
            Authentication, role-based dashboards, moderated publishing, registration, attendance,
            feedback, analytics, and audit records are implemented end to end.
          </p>
        </div>

        <div className="mt-10 grid overflow-hidden rounded-xl border border-line bg-paper sm:grid-cols-2 lg:mt-14">
          {capabilities.map((capability) => {
            const Icon = capability.icon;

            return (
              <article
                key={capability.number}
                className={cn(
                  "group relative min-h-[18rem] border-b border-line p-6 last:border-b-0 sm:p-8",
                  "sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(3)]:border-b-0 sm:[&:nth-child(4)]:border-b-0",
                  capability.dark ? "bg-ink text-paper" : "bg-paper text-ink",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={cn(
                      "text-[10px] font-bold tracking-[0.16em]",
                      capability.dark ? "text-signal" : "text-signal-dark",
                    )}
                  >
                    {capability.number}
                  </span>
                  <span
                    className={cn(
                      "grid size-10 place-items-center rounded-full border",
                      capability.dark
                        ? "border-paper/20 bg-paper/5 text-paper"
                        : "border-line bg-canvas/50 text-forest",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.6} />
                  </span>
                </div>

                <h3
                  className={cn(
                    "mt-12 max-w-[12ch] font-display text-[2rem] leading-[0.98] tracking-[-0.02em]",
                    capability.dark ? "text-paper" : "text-ink",
                  )}
                >
                  {capability.title}
                </h3>
                <p
                  className={cn(
                    "mt-4 max-w-md text-sm leading-6",
                    capability.dark ? "text-paper/65" : "text-muted",
                  )}
                >
                  {capability.description}
                </p>
                <p
                  className={cn(
                    "mt-6 border-t pt-4 text-[10px] font-bold uppercase tracking-[0.12em]",
                    capability.dark ? "border-paper/15 text-paper/55" : "border-line text-muted",
                  )}
                >
                  {capability.note}
                </p>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

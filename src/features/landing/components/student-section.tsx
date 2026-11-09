import { Bookmark, CalendarDays, Check, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const studentFeatures = [
  {
    icon: Sparkles,
    title: "A feed with a reason",
    description:
      "Events surface because they match your interests, your campus, and your week — not because they shouted loudest.",
  },
  {
    icon: CalendarDays,
    title: "See the shape of your week",
    description:
      "Registration deadlines, class conflicts, and saved events sit together so you can decide without opening five tabs.",
  },
  {
    icon: Bookmark,
    title: "Save now. Decide later.",
    description:
      "Keep an eye on something interesting, get a reminder before registration closes, and bring your friends along.",
  },
];

const sampleWeek = [
  {
    day: "THU",
    date: "12",
    title: "Founders' Table",
    meta: "6:30 PM · Innovation Studio",
    accent: true,
  },
  { day: "SAT", date: "14", title: "Jazz on the Lawn", meta: "5:00 PM · Main Lawn" },
  { day: "TUE", date: "17", title: "Design Critique Night", meta: "7:00 PM · Studio 2" },
];

function StudentPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-float">
      <div className="flex items-center justify-between gap-4 border-b border-line bg-forest px-5 py-4 text-paper">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/55">
            Student view / sample
          </p>
          <p className="mt-1 font-display text-2xl leading-none tracking-[-0.02em]">
            Good morning, Mira.
          </p>
        </div>
        <span className="grid size-9 place-items-center rounded-full border border-paper/20 bg-paper/10 text-[11px] font-bold">
          MS
        </span>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
              Your week
            </p>
            <span className="text-[10px] font-medium text-muted">Nov 2026</span>
          </div>
          <div className="mt-3 space-y-2">
            {sampleWeek.map((item) => (
              <div
                key={item.title}
                className={`grid grid-cols-[38px_1fr] gap-3 rounded-md border p-2.5 ${
                  item.accent ? "border-signal/40 bg-signal/5" : "border-line bg-canvas/35"
                }`}
              >
                <div className="flex flex-col items-center justify-center border-r border-line/80 pr-2">
                  <span className="text-[8px] font-bold tracking-[0.12em] text-muted">
                    {item.day}
                  </span>
                  <span className="font-display text-xl leading-none tracking-[-0.03em] text-ink">
                    {item.date}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 truncate text-[10px] text-muted">{item.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-line pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-signal/15 text-signal-dark">
              <Sparkles aria-hidden="true" className="size-3.5" />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
              Because you follow
            </p>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            <span className="font-semibold text-ink">Design, entrepreneurship,</span> and{" "}
            <span className="font-semibold text-ink">live music</span>
          </p>
          <div className="mt-4 rounded-md border border-line bg-canvas/45 p-3">
            <Badge variant="signal">Saved</Badge>
            <p className="mt-2 text-sm font-semibold leading-5 text-ink">Jazz on the Lawn</p>
            <p className="mt-1 text-[10px] leading-4 text-muted">
              Registration reminder set for 12 Nov
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-forest">
              <Check aria-hidden="true" className="size-3.5" />
              Fits your Saturday afternoon
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {["Design", "Startups", "Music"].map((interest) => (
              <span
                key={interest}
                className="rounded-full border border-line-strong px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-muted"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StudentSection() {
  return (
    <section id="students" className="border-b border-line bg-paper py-16 sm:py-20 lg:py-28">
      <Container className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-20">
        <div>
          <SectionHeading
            eyebrow="For students"
            title={
              <>
                Your campus,
                <span className="italic text-forest"> tuned to your week.</span>
              </>
            }
            description="The student experience starts with relevance. CampusPulse is designed to help you find the things you would have been glad to know about — before they happen."
          />

          <div className="mt-9 border-t border-line-strong">
            {studentFeatures.map((feature) => {
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
        </div>

        <div className="relative">
          <div className="absolute -left-4 top-10 hidden h-32 w-px bg-line-strong lg:block" />
          <StudentPreview />
          <p className="mt-4 text-right text-[10px] font-medium text-muted">
            Fictional student and events for interface preview only.
          </p>
        </div>
      </Container>
    </section>
  );
}

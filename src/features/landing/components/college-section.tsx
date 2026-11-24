import { ArrowUpRight, CheckCircle2, ClipboardCheck, ScrollText, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const collegeFeatures = [
  {
    icon: ClipboardCheck,
    title: "A visible moderation queue",
    description:
      "Review event submissions, request changes, and keep a clear record of who approved what and when.",
  },
  {
    icon: ShieldCheck,
    title: "Duplicate review with context",
    description:
      "Catch the same event posted twice before students see it, with the evidence and review history in one place.",
  },
  {
    icon: ScrollText,
    title: "An audit trail that matters",
    description:
      "Role changes, approvals, cancellations, and sensitive moderation actions are recorded without storing secrets.",
  },
];

const queueItems = [
  {
    title: "Founders' Table: Building for Campus",
    club: "Entrepreneurship Cell",
    status: "Needs review",
  },
  { title: "Sunday Cinema: Open Screen", club: "Film Club", status: "Needs review" },
  { title: "Hack the Ordinary", club: "Computer Science Society", status: "Approved" },
];

const auditItems = [
  { action: "Event approved", detail: "Design Critique Night", actor: "College admin" },
  { action: "Club approved", detail: "Design Collective", actor: "College admin" },
  { action: "Event cancelled", detail: "Open Mic Night", actor: "Club admin" },
];

function CollegePreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-paper/15 bg-paper text-ink shadow-float">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas/60 px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            College admin / sample
          </p>
          <p className="mt-1 font-display text-2xl leading-none tracking-[-0.02em]">
            Northfield University
          </p>
        </div>
        <Badge variant="forest">Moderation</Badge>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
              Review queue
            </p>
            <span className="text-[9px] font-medium text-muted">Sample items</span>
          </div>
          <div className="mt-3 space-y-2">
            {queueItems.map((item) => (
              <div key={item.title} className="rounded-md border border-line bg-canvas/35 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 text-[10px] text-muted">{item.club}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] ${
                      item.status === "Approved"
                        ? "bg-success/10 text-success"
                        : "bg-signal/15 text-signal-dark"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/login"
            className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-forest transition-colors hover:text-signal-dark"
          >
            Sign in to review
            <ArrowUpRight aria-hidden="true" className="size-3" />
          </Link>
        </div>

        <div className="border-t border-line pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <div className="flex items-center gap-2">
            <ScrollText aria-hidden="true" className="size-3.5 text-forest" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
              Audit trail
            </p>
          </div>
          <div className="mt-3 space-y-3">
            {auditItems.map((item) => (
              <div
                key={item.action + item.detail}
                className="border-b border-line pb-3 last:border-b-0 last:pb-0"
              >
                <p className="text-[11px] font-semibold text-ink">{item.action}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted">{item.detail}</p>
                <p className="mt-0.5 text-[9px] text-muted/80">{item.actor}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[9px] font-medium text-muted">
            <CheckCircle2 aria-hidden="true" className="size-3 text-success" />
            Sensitive actions stay reviewable
          </div>
        </div>
      </div>
    </div>
  );
}

export function CollegeSection() {
  return (
    <section
      id="colleges"
      className="relative overflow-hidden bg-ink py-16 text-paper sm:py-20 lg:py-28"
    >
      <div className="section-grid-dark pointer-events-none absolute inset-0 opacity-60" />
      <Container className="relative grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-20">
        <div>
          <SectionHeading
            eyebrow="For colleges"
            tone="dark"
            title={
              <>
                A campus-wide view,
                <span className="italic text-signal"> without the spreadsheet.</span>
              </>
            }
            description="Administrators need more than a feed. They need to know what is being published, who approved it, and where the campus calendar needs attention."
          />

          <div className="mt-9 border-t border-paper/15">
            {collegeFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="grid gap-3 border-b border-paper/15 py-5 sm:grid-cols-[2rem_1fr]"
                >
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 size-4 text-signal"
                    strokeWidth={1.7}
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-paper">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-paper/55">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <CollegePreview />
          <p className="mt-4 text-right text-[10px] font-medium text-paper/40">
            Fictional college and moderation data for interface preview only.
          </p>
        </div>
      </Container>
    </section>
  );
}

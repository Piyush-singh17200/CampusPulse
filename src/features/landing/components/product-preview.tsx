"use client";

import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Compass,
  FileCheck2,
  MapPin,
  ScrollText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

type PreviewRole = "student" | "club" | "college" | "platform";

type RoleOption = {
  id: PreviewRole;
  label: string;
  eyebrow: string;
  icon: LucideIcon;
};

const roles: RoleOption[] = [
  { id: "student", label: "Student", eyebrow: "Discovery", icon: Compass },
  { id: "club", label: "Club", eyebrow: "Operations", icon: ClipboardList },
  { id: "college", label: "College", eyebrow: "Moderation", icon: Building2 },
  { id: "platform", label: "Platform", eyebrow: "Network", icon: ShieldCheck },
];

function PreviewChrome({ role }: { role: RoleOption }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink px-4 py-3 text-paper sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="size-1.5 rounded-full bg-paper/25" />
          <span className="size-1.5 rounded-full bg-paper/25" />
          <span className="size-1.5 rounded-full bg-signal" />
        </div>
        <span className="truncate text-[10px] font-bold uppercase tracking-[0.16em]">
          CampusPulse / {role.eyebrow}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-[9px] font-semibold uppercase tracking-[0.12em] text-paper/45 sm:inline">
          Illustrative workspace
        </span>
        <span className="grid size-6 place-items-center rounded-full border border-paper/20 bg-paper/10 text-[9px] font-bold">
          CP
        </span>
      </div>
    </div>
  );
}

function MiniNav({ items, active }: { items: string[]; active: string }) {
  return (
    <aside className="hidden border-r border-line bg-canvas/45 p-3 sm:block">
      <p className="px-2 text-[8px] font-bold uppercase tracking-[0.16em] text-muted">Workspace</p>
      <div className="mt-3 space-y-1">
        {items.map((item) => (
          <div
            key={item}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-[9px] font-semibold",
              item === active ? "bg-ink text-paper" : "text-muted",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1 rounded-full",
                item === active ? "bg-signal" : "bg-line-strong",
              )}
            />
            {item}
          </div>
        ))}
      </div>
    </aside>
  );
}

function EventRow({
  title,
  meta,
  accent,
  saved,
}: {
  title: string;
  meta: string;
  accent?: boolean;
  saved?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2.5",
        accent ? "border-signal/35 bg-signal/5" : "border-line bg-paper",
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md",
          accent ? "bg-signal text-ink" : "bg-sage text-forest",
        )}
        aria-hidden="true"
      >
        <CalendarDays className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-bold text-ink">{title}</p>
        <p className="mt-0.5 truncate text-[9px] text-muted">{meta}</p>
      </div>
      {saved ? (
        <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.1em] text-forest">
          Saved
        </span>
      ) : null}
    </div>
  );
}

function StudentPanel() {
  return (
    <div className="grid min-h-[28rem] min-w-0 sm:grid-cols-[8.5rem_1fr]">
      <MiniNav
        items={["Overview", "Discover", "My events", "Saved", "Calendar"]}
        active="Overview"
      />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-forest">
              Thursday, 12 November
            </p>
            <p className="mt-1 font-display text-2xl leading-none tracking-[-0.02em] text-ink">
              Good evening, Isha.
            </p>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex">
            3 matches
          </Badge>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-forest/20 bg-forest text-paper">
          <div className="grid grid-cols-[3.2rem_1fr] gap-3 p-3.5">
            <div className="flex flex-col items-center justify-center rounded-md border border-paper/20 bg-paper/10 py-2">
              <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-signal">
                Thu
              </span>
              <span className="font-display text-2xl leading-none">12</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-signal">
                  Next up
                </span>
                <span className="rounded-full border border-paper/20 px-1.5 py-0.5 text-[8px] font-semibold text-paper/65">
                  Registered
                </span>
              </div>
              <p className="mt-1.5 truncate text-sm font-bold">Founders&apos; Table</p>
              <p className="mt-1 flex items-center gap-1 text-[9px] text-paper/55">
                <MapPin aria-hidden="true" className="size-2.5" />
                Innovation Studio · 6:30 PM
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-paper/15 px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-[9px] font-medium text-paper/60">
              <CheckCircle2 aria-hidden="true" className="size-3 text-signal" />
              Matches your entrepreneurship interest
            </span>
            <ArrowUpRight aria-hidden="true" className="size-3.5 text-signal" />
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          <EventRow title="Jazz on the Lawn" meta="Sat · 5:00 PM · Main Lawn" saved />
          <EventRow title="Design Critique Night" meta="Tue · 7:00 PM · Studio 2" accent />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[9px] text-muted">
          <span>2 saved · 1 registration this week</span>
          <span className="font-semibold text-forest">No schedule conflicts</span>
        </div>
      </div>
    </div>
  );
}

function ClubPanel() {
  return (
    <div className="grid min-h-[28rem] min-w-0 sm:grid-cols-[8.5rem_1fr]">
      <MiniNav
        items={["Overview", "Events", "Create event", "Registrations", "Attendance"]}
        active="Overview"
      />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-forest">
              Club workspace
            </p>
            <p className="mt-1 font-display text-2xl leading-none tracking-[-0.02em] text-ink">
              Robotics Society
            </p>
          </div>
          <Badge variant="forest">Active</Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["12", "registrations"],
            ["2", "in review"],
            ["1", "draft"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-md border border-line bg-canvas/45 px-2.5 py-2">
              <p className="text-base font-bold leading-none tracking-[-0.03em] text-ink">
                {value}
              </p>
              <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted">
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-md border border-line bg-paper p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-forest">
              Next event
            </p>
            <span className="text-[8px] font-semibold text-muted">Published</span>
          </div>
          <p className="mt-1.5 text-xs font-bold text-ink">Build Night: Line Followers</p>
          <p className="mt-1 text-[9px] text-muted">Fri · 6:00 PM · Makerspace · 12 registered</p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-paper-dim">
            <div className="h-full w-[68%] rounded-full bg-forest" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[8px] text-muted">
            <span>17 of 25 seats</span>
            <span>Registration open</span>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          <div className="flex items-center gap-2 rounded-md border border-signal/30 bg-signal/5 px-3 py-2">
            <FileCheck2 aria-hidden="true" className="size-3.5 shrink-0 text-signal-dark" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] font-bold text-ink">
                Poster details ready to review
              </p>
              <p className="text-[8px] text-muted">OCR found title, date, venue, and summary</p>
            </div>
            <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.1em] text-signal-dark">
              Review
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-line bg-canvas/45 px-3 py-2 text-[9px] text-muted">
            <UsersRound aria-hidden="true" className="size-3.5 shrink-0 text-forest" />
            Attendance opens 30 minutes before the event.
          </div>
        </div>
      </div>
    </div>
  );
}

function CollegePanel() {
  return (
    <div className="grid min-h-[28rem] min-w-0 sm:grid-cols-[8.5rem_1fr]">
      <MiniNav
        items={["Overview", "Events", "Approvals", "Clubs", "Audit logs"]}
        active="Overview"
      />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-forest">
              College administration
            </p>
            <p className="mt-1 font-display text-2xl leading-none tracking-[-0.02em] text-ink">
              Northfield University
            </p>
          </div>
          <Badge variant="signal">3 pending</Badge>
        </div>

        <div className="mt-4 rounded-md border border-line bg-paper">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-forest">
              Review queue
            </p>
            <span className="text-[8px] text-muted">Oldest first</span>
          </div>
          {[
            ["Hack the Ordinary", "Computer Science Society · starts 21 Nov"],
            ["Sunday Cinema: Open Screen", "Film Club · starts 23 Nov"],
            ["Founders' Table", "Entrepreneurship Cell · starts 12 Nov"],
          ].map(([title, meta], index) => (
            <div
              key={title}
              className="flex items-center gap-2 border-b border-line px-3 py-2.5 last:border-b-0"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-signal/10 text-[8px] font-bold text-signal-dark">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[9px] font-bold text-ink">{title}</p>
                <p className="mt-0.5 truncate text-[8px] text-muted">{meta}</p>
              </div>
              <span className="shrink-0 rounded-full bg-signal/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-signal-dark">
                Review
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-canvas/45 px-3 py-2.5">
            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-muted">
              Duplicate check
            </p>
            <p className="mt-1 text-[9px] font-semibold text-ink">No unresolved matches</p>
          </div>
          <div className="rounded-md border border-line bg-canvas/45 px-3 py-2.5">
            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-muted">
              Club applications
            </p>
            <p className="mt-1 text-[9px] font-semibold text-ink">1 waiting for a decision</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 text-[8px] text-muted">
          <ScrollText aria-hidden="true" className="size-3 text-forest" />
          Approval decisions are recorded in the audit trail.
        </div>
      </div>
    </div>
  );
}

function PlatformPanel() {
  return (
    <div className="grid min-h-[28rem] min-w-0 sm:grid-cols-[8.5rem_1fr]">
      <MiniNav
        items={["Overview", "Colleges", "Users", "Analytics", "Audit history"]}
        active="Overview"
      />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-forest">
              Platform administration
            </p>
            <p className="mt-1 font-display text-2xl leading-none tracking-[-0.02em] text-ink">
              Network overview
            </p>
          </div>
          <Badge variant="outline">2 colleges</Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["13", "users"],
            ["5", "clubs"],
            ["24", "events"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-md border border-line bg-canvas/45 px-2.5 py-2">
              <p className="text-base font-bold leading-none tracking-[-0.03em] text-ink">
                {value}
              </p>
              <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted">
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-md border border-line bg-paper">
          <div className="border-b border-line px-3 py-2.5">
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-forest">
              College workspaces
            </p>
          </div>
          {[
            ["Northfield University", "8 users · 3 clubs · 16 events", "Active"],
            ["Lakeview Institute", "5 users · 2 clubs · 8 events", "Active"],
          ].map(([name, meta, status]) => (
            <div
              key={name}
              className="flex items-center gap-2 border-b border-line px-3 py-2.5 last:border-b-0"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-sage text-forest">
                <Building2 aria-hidden="true" className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[9px] font-bold text-ink">{name}</p>
                <p className="mt-0.5 truncate text-[8px] text-muted">{meta}</p>
              </div>
              <span className="shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-success">
                {status}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-canvas/45 px-3 py-2.5">
          <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0 text-forest" />
          <p className="text-[8px] leading-4 text-muted">
            Platform access is separate from college administration. Tenant data stays scoped.
          </p>
        </div>
      </div>
    </div>
  );
}

const panels: Record<PreviewRole, () => ReactNode> = {
  student: StudentPanel,
  club: ClubPanel,
  college: CollegePanel,
  platform: PlatformPanel,
};

export function ProductPreview() {
  const [activeRole, setActiveRole] = useState<PreviewRole>("student");
  const role = roles.find((item) => item.id === activeRole) ?? roles[0];
  const Panel = panels[activeRole];

  return (
    <div
      className="w-full min-w-0 overflow-hidden rounded-xl border border-line bg-paper shadow-float"
      aria-label="Interactive CampusPulse role preview with illustrative data"
    >
      <PreviewChrome role={role} />

      <div className="flex gap-1 overflow-x-auto border-b border-line bg-canvas/65 p-2">
        {roles.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeRole;

          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveRole(item.id)}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[9px] font-bold uppercase tracking-[0.08em] transition-colors sm:text-[10px]",
                active ? "bg-ink text-paper" : "text-muted hover:bg-paper hover:text-ink",
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn("size-3.5 shrink-0", active ? "text-signal" : "text-forest")}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div key={activeRole} className="motion-safe:animate-rise">
        <Panel />
      </div>
    </div>
  );
}

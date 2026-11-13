import { ArrowUpRight, CalendarDays, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import type { DashboardEvent } from "@/server/dashboards/queries";

const accents = [
  "bg-forest text-paper",
  "bg-signal text-ink",
  "bg-sage text-ink",
  "bg-gold text-ink",
];

function accentFor(event: DashboardEvent): string {
  const seed = event.id.charCodeAt(0) + event.id.charCodeAt(event.id.length - 1);
  return accents[seed % accents.length] ?? accents[0];
}

export function DashboardEventCard({
  event,
  href,
  action,
  saved,
  registered,
  activeCount,
  compact = false,
  className,
}: {
  event: DashboardEvent;
  href: string;
  action?: ReactNode;
  saved?: boolean;
  registered?: boolean;
  activeCount?: number;
  compact?: boolean;
  className?: string;
}) {
  const categories = event.categories.map((item) => item.category);

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-card transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-float motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
    >
      <div
        className={cn("relative overflow-hidden p-4", accentFor(event), compact ? "pb-4" : "pb-5")}
      >
        <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-65">Event</p>
            <p className="mt-1 font-display text-2xl leading-none">
              {formatDate(event.startsAt).split(",")[0]}
            </p>
            <p className="mt-1 text-[11px] font-semibold opacity-75">
              {formatTime(event.startsAt)}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <StatusBadge status={event.status} />
            {saved ? <Badge variant="dark">Saved</Badge> : null}
            {registered ? <Badge variant="dark">Registered</Badge> : null}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5">
          {categories.slice(0, 2).map((category) => (
            <Badge key={category.id} variant="sage">
              {category.name}
            </Badge>
          ))}
        </div>
        <h3 className="mt-3 text-balance text-[17px] font-bold leading-snug tracking-[-0.02em] text-ink">
          <Link
            href={href}
            className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
          >
            {event.title}
          </Link>
        </h3>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-forest">
          {event.club.name}
        </p>
        {event.summary && !compact ? (
          <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted">{event.summary}</p>
        ) : null}

        <div className="mt-4 space-y-1.5 text-[12px] text-muted">
          <p className="flex items-center gap-2">
            <CalendarDays aria-hidden="true" className="size-3.5 shrink-0 text-forest" />
            {formatDate(event.startsAt)} · {formatTime(event.startsAt)}–{formatTime(event.endsAt)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-forest" />
            <span className="truncate">{event.isOnline ? "Online event" : event.venueName}</span>
          </p>
          <p className="flex items-center gap-2">
            <UsersRound aria-hidden="true" className="size-3.5 shrink-0 text-forest" />
            {typeof activeCount === "number"
              ? `${activeCount} confirmed${event.capacity ? ` · capacity ${event.capacity}` : ""}`
              : `${event._count.registrations} registrations${event.capacity ? ` · capacity ${event.capacity}` : ""}`}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5">
          {action ?? (
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-forest hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
            >
              View event
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

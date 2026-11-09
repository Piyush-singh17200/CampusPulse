import { CalendarDays, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { PreviewEvent } from "@/features/landing/data/preview-events";
import { cn } from "@/lib/cn";

const accentClasses: Record<PreviewEvent["accent"], string> = {
  signal: "bg-signal text-ink",
  forest: "bg-forest text-paper",
  gold: "bg-gold text-ink",
  sage: "bg-sage text-ink",
};

type EventCardProps = {
  event: PreviewEvent;
  variant?: "featured" | "compact" | "list";
  action?: ReactNode;
  className?: string;
};

function EventArtwork({ event }: { event: PreviewEvent }) {
  return (
    <div className={cn("relative overflow-hidden p-5", accentClasses[event.accent])}>
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative flex items-start justify-between gap-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
          CampusPulse preview
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
          Sample event
        </span>
      </div>
      <div className="relative mt-8 flex items-end gap-2">
        <span className="font-display text-[6.5rem] leading-[0.68] tracking-[-0.06em]">
          {event.day}
        </span>
        <span className="mb-1 text-sm font-bold uppercase tracking-[0.18em]">{event.month}</span>
      </div>
      <p className="relative mt-6 max-w-[16rem] text-[11px] font-bold uppercase leading-4 tracking-[0.16em] opacity-75">
        {event.club}
      </p>
    </div>
  );
}

function EventMeta({ event, compact = false }: { event: PreviewEvent; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-5 text-muted",
        compact && "gap-y-1.5",
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays aria-hidden="true" className="size-3.5 text-forest" />
        {event.dateLabel} · {event.time}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MapPin aria-hidden="true" className="size-3.5 text-forest" />
        {event.venue}
      </span>
    </div>
  );
}

export function EventCard({ event, variant = "compact", action, className }: EventCardProps) {
  if (variant === "featured") {
    return (
      <article
        className={cn(
          "group overflow-hidden rounded-xl border border-line bg-paper shadow-card transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-float",
          className,
        )}
      >
        <EventArtwork event={event} />
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="signal">{event.category}</Badge>
            <span className="text-[11px] font-medium text-muted">{event.club}</span>
          </div>
          <h3 className="mt-3 text-balance font-display text-[1.65rem] leading-[1.02] tracking-[-0.02em] text-ink">
            {event.title}
          </h3>
          <div className="mt-4">
            <EventMeta event={event} />
          </div>
          <div className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-4">
            <span className="text-xs font-semibold text-forest">{event.registration}</span>
            {action}
          </div>
        </div>
      </article>
    );
  }

  if (variant === "list") {
    return (
      <article
        className={cn(
          "group grid gap-4 border-t border-line py-5 sm:grid-cols-[72px_1fr_auto] sm:items-center",
          className,
        )}
      >
        <div className="flex items-baseline gap-2 sm:flex-col sm:gap-0">
          <span className="font-display text-4xl leading-none tracking-[-0.04em] text-ink">
            {event.day}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            {event.month}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
              {event.category}
            </span>
            <span className="text-[10px] text-muted">/ {event.club}</span>
          </div>
          <h3 className="mt-1.5 truncate font-semibold tracking-[-0.01em] text-ink">
            {event.title}
          </h3>
          <p className="mt-1 truncate text-xs text-muted">
            {event.time} · {event.venue}
          </p>
        </div>
        <div className="sm:justify-self-end">{action}</div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "group grid grid-cols-[52px_1fr] gap-4 rounded-lg border border-line bg-paper p-4 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-card",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-[58px] flex-col items-center justify-center rounded-md",
          accentClasses[event.accent],
        )}
      >
        <span className="font-display text-2xl leading-none tracking-[-0.03em]">{event.day}</span>
        <span className="mt-0.5 text-[9px] font-bold tracking-[0.14em]">{event.month}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-forest">
            {event.category}
          </span>
          <span className="text-[9px] text-muted">/ {event.club}</span>
        </div>
        <h3 className="mt-1 text-sm font-semibold leading-5 tracking-[-0.01em] text-ink">
          {event.title}
        </h3>
        <p className="mt-1 truncate text-[11px] text-muted">
          {event.time} · {event.venue}
        </p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </article>
  );
}

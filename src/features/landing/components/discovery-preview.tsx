"use client";

import { ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EventCard } from "@/components/ui/event-card";
import { EmptyState } from "@/components/ui/states";
import {
  previewCategories,
  previewEvents,
  type PreviewEvent,
} from "@/features/landing/data/preview-events";
import { cn } from "@/lib/cn";

type DiscoveryPreviewProps = {
  compact?: boolean;
  className?: string;
};

function EventDetail({ event }: { event: PreviewEvent }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="signal">{event.category}</Badge>
        <Badge variant="outline">Sample preview data</Badge>
      </div>
      <p className="mt-5 text-sm leading-6 text-ink-soft">{event.description}</p>
      <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">When</dt>
          <dd className="mt-1.5 font-medium text-ink">
            {event.dateLabel} · {event.time}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Where</dt>
          <dd className="mt-1.5 font-medium text-ink">{event.venue}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            Hosted by
          </dt>
          <dd className="mt-1.5 font-medium text-ink">{event.club}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            Registration
          </dt>
          <dd className="mt-1.5 font-medium text-ink">{event.registration}</dd>
        </div>
      </dl>
      <p className="mt-6 rounded-md border border-line bg-canvas/70 p-3 text-xs leading-5 text-muted">
        This is an illustrative event for the product preview. Live events, registration, saved
        events, and notifications are available in the signed-in student workspace.
      </p>
    </div>
  );
}

export function DiscoveryPreview({ compact = false, className }: DiscoveryPreviewProps) {
  const [activeCategory, setActiveCategory] =
    useState<(typeof previewCategories)[number]>("All events");
  const [selectedEvent, setSelectedEvent] = useState<PreviewEvent | null>(null);

  const filteredEvents = useMemo(() => {
    if (activeCategory === "All events") {
      return previewEvents;
    }

    return previewEvents.filter((event) => event.category === activeCategory);
  }, [activeCategory]);

  const featuredEvent = filteredEvents[0] ?? previewEvents[0];
  const secondaryEvents = filteredEvents.slice(1, compact ? 3 : 5);

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-line bg-paper shadow-float",
          className,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas/65 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="size-2 rounded-full bg-line-strong" />
              <span className="size-2 rounded-full bg-line-strong" />
              <span className="size-2 rounded-full bg-signal" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              CampusPulse / Discovery
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Interactive sample</Badge>
            <span className="hidden text-[10px] font-semibold text-muted sm:inline">
              Northfield University
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="border-b border-line bg-canvas/35 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest">
              Explore campus
            </p>
            <p className="mt-3 font-display text-3xl leading-none tracking-[-0.02em] text-ink">
              Your week,
              <br />
              <span className="italic text-forest">with context.</span>
            </p>
            <p className="mt-3 max-w-xs text-xs leading-5 text-muted">
              A fictional college feed showing how interests, timing, and campus context can sit
              together in one place.
            </p>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {previewCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={activeCategory === category}
                  onClick={() => setActiveCategory(category)}
                  className={cn(
                    "rounded-full border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors",
                    activeCategory === category
                      ? "border-ink bg-ink text-paper"
                      : "border-line-strong bg-paper text-muted hover:border-ink hover:text-ink",
                  )}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2 border-t border-line pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              <SlidersHorizontal aria-hidden="true" className="size-3.5 text-forest" />
              Filters, calendar, and saved events
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              Filters, calendar, and saved events are live in the student workspace.
            </p>
          </aside>

          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest">
                  {activeCategory}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {filteredEvents.length} sample {filteredEvents.length === 1 ? "event" : "events"}
                </p>
              </div>
              <span className="text-[10px] font-medium text-muted">Illustrative data</span>
            </div>

            {filteredEvents.length === 0 ? (
              <EmptyState
                className="mt-4"
                title="No events in this view"
                description="Try another category. Empty states are designed so students always know what to do next."
              />
            ) : (
              <div className="mt-4">
                <EventCard
                  event={featuredEvent}
                  variant="featured"
                  action={
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(featuredEvent)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-ink transition-colors hover:text-signal-dark"
                    >
                      View details
                      <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </button>
                  }
                />

                <div className="mt-3 space-y-2.5">
                  {secondaryEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      variant="compact"
                      action={
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          className="text-[10px] font-bold uppercase tracking-[0.12em] text-forest transition-colors hover:text-signal-dark"
                        >
                          View
                        </button>
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="mt-4 flex items-center gap-1.5 text-[10px] leading-4 text-muted">
              <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
              Sample events are fictional and shown only to demonstrate the product. Create an
              account to browse live campus events.
            </p>
          </div>
        </div>
      </div>

      <Dialog
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title ?? "Event preview"}
        description={
          selectedEvent ? `${selectedEvent.club} · ${selectedEvent.category}` : undefined
        }
        footer={
          <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>
            Close preview
          </Button>
        }
      >
        {selectedEvent ? <EventDetail event={selectedEvent} /> : null}
      </Dialog>
    </>
  );
}

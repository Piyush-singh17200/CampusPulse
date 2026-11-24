import { ImageOff } from "lucide-react";

import { PosterImage, type PosterView } from "@/components/dashboard/poster-image";
import { cn } from "@/lib/cn";

export function EventPoster({
  poster,
  eventTitle,
  className,
  emptyLabel = "No poster has been uploaded yet.",
  priority = false,
}: {
  poster: PosterView | null | undefined;
  eventTitle: string;
  className?: string;
  emptyLabel?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[16/9] overflow-hidden rounded-lg border border-line bg-canvas",
        className,
      )}
    >
      {poster ? (
        <PosterImage
          key={poster.id}
          poster={poster}
          eventTitle={eventTitle}
          sizes="(min-width: 1280px) 45vw, (min-width: 768px) 60vw, 100vw"
          priority={priority}
        />
      ) : (
        <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-canvas p-5 text-ink sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border border-line"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-10 size-40 rounded-full border border-line"
          />
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-signal-dark">
              Poster pending
            </span>
            <ImageOff aria-hidden="true" className="size-4 text-muted" />
          </div>
          <div className="relative mt-4 max-w-[26ch]">
            <p className="line-clamp-3 font-display text-[clamp(1.35rem,3.4vw,2.6rem)] leading-[0.96] tracking-[-0.02em]">
              {eventTitle}
            </p>
            <p className="mt-3 text-[10px] leading-4 text-muted">{emptyLabel}</p>
          </div>
        </div>
      )}
    </div>
  );
}

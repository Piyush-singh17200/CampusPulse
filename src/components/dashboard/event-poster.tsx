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
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-muted">
          <ImageOff aria-hidden="true" className="size-6" />
          <p className="text-xs font-semibold leading-5">{emptyLabel}</p>
        </div>
      )}
    </div>
  );
}

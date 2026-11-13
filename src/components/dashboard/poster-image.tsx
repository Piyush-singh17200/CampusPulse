"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { posterAltText, posterUrl } from "@/lib/poster";

export type PosterView = {
  id: string;
  altText: string | null;
  width?: number | null;
  height?: number | null;
};

export function PosterImage({
  poster,
  eventTitle,
  className,
  sizes,
  priority = false,
}: {
  poster: PosterView;
  eventTitle: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const alt = posterAltText(poster.altText, eventTitle);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt}. The image could not be loaded.`}
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2 bg-canvas p-4 text-center text-muted",
          className,
        )}
      >
        <ImageOff aria-hidden="true" className="size-5" />
        <span className="text-[11px] font-semibold">Poster unavailable</span>
      </div>
    );
  }

  return (
    <Image
      src={posterUrl(poster.id)}
      alt={alt}
      width={poster.width ?? 1200}
      height={poster.height ?? 800}
      unoptimized
      priority={priority}
      sizes={sizes}
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

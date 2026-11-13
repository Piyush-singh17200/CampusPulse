"use client";

import Image from "next/image";
import { ImageOff, ImagePlus, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { ChangeEvent } from "react";

import { PosterImage, type PosterView } from "@/components/dashboard/poster-image";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export function PosterField({
  currentPoster,
  eventTitle,
  showCurrentPoster = true,
}: {
  currentPoster?: PosterView | null;
  eventTitle: string;
  showCurrentPoster?: boolean;
}) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function resetSelection() {
    setPreviewUrl(null);
    setPreviewFailed(false);
    setFileName(null);
    setClientError(null);
    setInputKey((value) => value + 1);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreviewFailed(false);

    if (!file) {
      setPreviewUrl(null);
      setFileName(null);
      setClientError(null);
      return;
    }

    if (file.size > MAX_BYTES) {
      setClientError("Posters must be 5 MB or smaller.");
      setPreviewUrl(null);
      setFileName(null);
      event.target.value = "";
      return;
    }

    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      setClientError("Choose a JPEG, PNG, or WebP image. SVG is not accepted.");
      setPreviewUrl(null);
      setFileName(null);
      event.target.value = "";
      return;
    }

    setClientError(null);
    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
  }

  const hasPreview = Boolean(previewUrl);
  const hasCurrentPoster = Boolean(currentPoster);
  const hasVisibleCurrent = hasCurrentPoster && showCurrentPoster;

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          {hasPreview
            ? "Selected preview"
            : hasVisibleCurrent
              ? "Current poster"
              : "Poster preview"}
        </p>
        <div className="relative mt-2 aspect-[16/9] overflow-hidden rounded-lg border border-dashed border-line-strong bg-canvas">
          {hasPreview && previewUrl ? (
            previewFailed ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-5 text-center text-muted">
                <ImageOff aria-hidden="true" className="size-5" />
                <p className="text-[11px] font-semibold">This preview could not be rendered.</p>
              </div>
            ) : (
              <Image
                src={previewUrl}
                alt="Selected poster preview"
                fill
                unoptimized
                sizes="(min-width: 768px) 40vw, 100vw"
                onError={() => setPreviewFailed(true)}
                className="object-cover"
              />
            )
          ) : hasVisibleCurrent && currentPoster ? (
            <PosterImage
              poster={currentPoster}
              eventTitle={eventTitle}
              sizes="(min-width: 768px) 40vw, 100vw"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-5 text-center text-muted">
              <ImagePlus aria-hidden="true" className="size-5" />
              <p className="max-w-xs text-[11px] font-semibold leading-5">
                {showCurrentPoster
                  ? "No poster selected yet. A landscape image works best."
                  : "Choose a replacement image to see its preview."}
              </p>
            </div>
          )}
        </div>
        {fileName ? (
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
            <span className="truncate">{fileName}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetSelection}
              className="h-7 px-2"
            >
              <X aria-hidden="true" className="size-3.5" />
              Clear
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <Field
          id={`${inputId}-file`}
          label={hasCurrentPoster ? "Replace poster" : "Upload poster"}
          description="JPEG, PNG, or WebP. Maximum 5 MB. SVG and other formats are rejected."
          error={clientError ?? undefined}
        >
          <Input
            key={inputKey}
            id={`${inputId}-file`}
            name="poster"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            aria-describedby={`${inputId}-file-description${clientError ? ` ${inputId}-file-error` : ""}`}
            className="h-auto cursor-pointer py-2 file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-xs file:font-semibold file:text-paper hover:file:bg-ink-soft"
          />
        </Field>
        <Field
          id={`${inputId}-alt`}
          label="Poster alt text"
          description="Describe the image for screen readers. Defaults to the event title."
        >
          <Input
            id={`${inputId}-alt`}
            name="posterAltText"
            defaultValue={currentPoster?.altText ?? ""}
            maxLength={300}
            placeholder="e.g. Students presenting a robotics demo on stage"
          />
        </Field>
        <p className={cn("text-[11px] leading-5 text-muted", clientError && "text-danger")}>
          The image is validated again on the server by its actual file content.
        </p>
      </div>
    </div>
  );
}

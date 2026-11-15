"use client";

import jsQR from "jsqr";
import { AlertCircle, Camera, CameraOff, CheckCircle2, LoaderCircle, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { scanAttendanceAction } from "@/features/dashboards/actions";
import type { DashboardActionState } from "@/features/dashboards/types";

export function QrScanner({
  eventId,
  eventTitle,
  canScan,
}: {
  eventId: string;
  eventTitle: string;
  canScan: boolean;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const submittingRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<DashboardActionState | null>(null);
  const [manualCode, setManualCode] = useState("");

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const submitToken = useCallback(
    async (token: string) => {
      if (!canScan || submittingRef.current) {
        return;
      }

      submittingRef.current = true;
      setSubmitting(true);
      setResult(null);

      try {
        const formData = new FormData();
        formData.set("eventId", eventId);
        formData.set("token", token);
        const next = await scanAttendanceAction(formData);
        setResult(next);

        if (next.status === "success") {
          setManualCode("");
          router.refresh();
        }
      } catch {
        setResult({
          status: "error",
          message: "The scanner could not reach the attendance service. Please try again.",
        });
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [canScan, eventId, router],
  );

  async function startCamera() {
    if (!canScan || scanning) {
      return;
    }

    setCameraError(null);
    setResult(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support camera access. Use the manual code below.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      video.srcObject = stream;
      await video.play();
      setScanning(true);
      scanningRef.current = true;

      const scanFrame = () => {
        if (!scanningRef.current) {
          return;
        }

        const canvas = canvasRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (context) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(image.data, image.width, image.height, {
              inversionAttempts: "dontInvert",
            });

            if (code?.data) {
              stopCamera();
              void submitToken(code.data);
              return;
            }
          }
        }

        animationRef.current = requestAnimationFrame(scanFrame);
      };

      animationRef.current = requestAnimationFrame(scanFrame);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "CameraError";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraError(
          "Camera access was denied. Allow camera permission or use the manual code below.",
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCameraError("No usable camera was found. Use the manual code below.");
      } else {
        setCameraError("The camera could not start. Use the manual code below.");
      }
      stopCamera();
    }
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitToken(manualCode);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-canvas/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
              Camera check-in
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{eventTitle}</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Camera access starts only when you press the button. Nothing is recorded until a valid
              code is accepted by the server.
            </p>
          </div>
          {scanning ? (
            <Button type="button" variant="outline" size="sm" onClick={stopCamera}>
              <CameraOff aria-hidden="true" className="size-4" />
              Stop camera
            </Button>
          ) : (
            <Button
              type="button"
              variant="signal"
              size="md"
              onClick={startCamera}
              disabled={!canScan || submitting}
            >
              <Camera aria-hidden="true" className="size-4" />
              Start camera
            </Button>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-ink/95">
          <video
            ref={videoRef}
            className={scanning ? "aspect-video w-full object-cover" : "hidden"}
            muted
            playsInline
            aria-label="Live camera preview for QR check-in"
          />
          {!scanning ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center text-paper/70">
              <ScanLine aria-hidden="true" className="size-8 text-paper/45" />
              <p className="text-xs leading-5">
                {canScan
                  ? "The camera preview appears here after you start scanning."
                  : "Check-in is not open for this event right now."}
              </p>
            </div>
          ) : null}
        </div>
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      </div>

      {cameraError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-signal/30 bg-signal/5 px-3 py-2.5 text-xs leading-5 text-signal-dark"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {cameraError}
        </p>
      ) : null}

      <form onSubmit={handleManualSubmit} className="rounded-xl border border-line bg-paper p-4">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Manual attendance code
          </span>
          <textarea
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            rows={2}
            maxLength={256}
            required
            disabled={!canScan || submitting}
            placeholder="Paste the student's CampusPulse attendance code"
            className="mt-1.5 w-full rounded-md border border-line-strong bg-paper px-3 py-2 font-mono text-[11px] leading-5 text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15 disabled:opacity-60"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="outline" size="sm" disabled={!canScan || submitting}>
            {submitting ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <ScanLine aria-hidden="true" className="size-4" />
            )}
            {submitting ? "Checking code…" : "Check manual code"}
          </Button>
          <p className="text-[11px] leading-5 text-muted">
            Camera unavailable? Use the authorized registration list below to record attendance with
            a reason.
          </p>
        </div>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {result ? (
          <div
            role={result.status === "error" ? "alert" : "status"}
            className={
              result.status === "success"
                ? "rounded-xl border border-forest/25 bg-forest-soft/35 p-4"
                : "rounded-xl border border-signal/30 bg-signal/5 p-4"
            }
          >
            <div className="flex items-start gap-3">
              {result.status === "success" ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-forest" />
              ) : (
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-signal-dark"
                />
              )}
              <div>
                <p className="text-sm font-bold text-ink">
                  {result.status === "success" ? "Check-in recorded" : "Check-in rejected"}
                </p>
                <p className="mt-1 text-xs leading-5 text-ink-soft">{result.message}</p>
                {result.data?.scan ? (
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    {result.data.scan.studentName}
                    {result.data.scan.rollNumber ? ` · ${result.data.scan.rollNumber}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

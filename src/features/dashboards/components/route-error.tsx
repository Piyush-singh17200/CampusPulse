"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export function DashboardRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log only the digest. Error messages can contain application or user data.
    if (process.env.NODE_ENV !== "production") {
      console.error(`Dashboard route error digest: ${error.digest ?? "none"}`);
    }
  }, [error.digest]);

  return (
    <div className="rounded-xl border border-signal/30 bg-signal/5 p-6" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-signal-dark" />
        <div>
          <h2 className="text-base font-bold text-ink">This page could not load.</h2>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            The server returned an error without exposing internal details. Try the page again.
          </p>
          {error.digest ? (
            <p className="mt-3 inline-block rounded-md border border-line bg-paper px-2.5 py-1.5 font-mono text-[11px] text-muted">
              Digest: {error.digest}
            </p>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={reset}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonStyles } from "@/components/ui/button";

export function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(`Dashboard error digest: ${error.digest ?? "none"}`);
    }
  }, [error.digest]);

  return (
    <div className="mx-auto max-w-xl border-t border-line-strong pt-6">
      <p className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
        <span className="h-px w-7 bg-forest/40" />
        Something went wrong
      </p>
      <h1 className="mt-5 text-balance font-display text-5xl leading-[0.95] tracking-[-0.03em] text-ink">
        This workspace could not load.
      </h1>
      <p className="mt-5 text-sm leading-7 text-muted">
        The server returned an error without exposing internal details. Try the page again. If the
        problem continues, contact your administrator.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/account" className={buttonStyles({ variant: "outline" })}>
          Open account
        </Link>
      </div>
    </div>
  );
}

"use client";

import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <main className="flex min-h-screen items-center justify-center px-5 py-20">
          <div className="w-full max-w-xl border-t border-line-strong pt-6">
            <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-forest">
              <span className="h-px w-7 bg-forest/40" />
              Application error
            </p>
            <h1 className="mt-5 text-balance font-display text-5xl leading-[0.95] tracking-[-0.03em]">
              CampusPulse could not start this page.
            </h1>
            <p className="mt-5 text-sm leading-7 text-muted">
              The error has been contained. Try again, and if the problem continues, check the
              server logs using the request digest.
            </p>
            {error.digest ? (
              <p className="mt-5 inline-block rounded-md border border-line bg-paper px-3 py-2 font-mono text-xs text-muted">
                Digest: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-ink px-5 text-sm font-semibold text-paper transition-colors hover:bg-ink-soft"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}

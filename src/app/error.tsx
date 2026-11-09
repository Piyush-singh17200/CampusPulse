"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log only the digest. Error messages can contain application or user data.
    if (process.env.NODE_ENV !== "production") {
      console.error(`Application error digest: ${error.digest ?? "none"}`);
    }
  }, [error.digest]);

  return (
    <main className="flex min-h-screen items-center bg-canvas py-20">
      <Container>
        <div className="mx-auto max-w-xl border-t border-line-strong pt-6">
          <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-forest">
            <span className="h-px w-7 bg-forest/40" />
            Something went wrong
          </p>
          <h1 className="mt-5 text-balance font-display text-5xl leading-[0.95] tracking-[-0.03em] text-ink">
            This page could not be rendered.
          </h1>
          <p className="mt-5 text-sm leading-7 text-muted">
            The error has been contained. Try again, and if the problem continues, check the server
            logs using the request digest.
          </p>
          {error.digest ? (
            <p className="mt-5 inline-block rounded-md border border-line bg-paper px-3 py-2 font-mono text-xs text-muted">
              Digest: {error.digest}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={reset}>Try again</Button>
            <Link href="/" className={buttonStyles({ variant: "outline" })}>
              Return home
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}

import Link from "next/link";

import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center bg-canvas py-20">
      <Container>
        <div className="mx-auto max-w-xl border-t border-line-strong pt-6">
          <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-forest">
            <span className="h-px w-7 bg-forest/40" />
            404 / Not found
          </p>
          <h1 className="mt-5 text-balance font-display text-5xl leading-[0.95] tracking-[-0.03em] text-ink">
            That page does not exist.
          </h1>
          <p className="mt-5 text-sm leading-7 text-muted">
            The page may have moved, or the link may be incomplete. Return to the CampusPulse
            landing page to continue.
          </p>
          <Link href="/" className={buttonStyles({ className: "mt-8" })}>
            Return home
          </Link>
        </div>
      </Container>
    </main>
  );
}

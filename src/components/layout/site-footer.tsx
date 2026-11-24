import { ArrowUpRight } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="bg-canvas py-12 text-ink sm:py-16">
      <Container>
        <div className="grid gap-10 border-b border-line pb-10 lg:grid-cols-[1.4fr_0.6fr_0.6fr_0.8fr]">
          <div className="max-w-sm">
            <a
              href="#top"
              className="inline-flex items-center gap-2.5 rounded-md text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
            >
              <BrandMark className="size-8 text-ink" />
              <span className="font-semibold tracking-[-0.02em]">{siteConfig.name}</span>
            </a>
            <p className="mt-4 text-sm leading-6 text-muted">{siteConfig.description}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-line-strong px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
              <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
              Academic demonstration build
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-forest">Product</p>
            <ul className="mt-4 space-y-2.5">
              {siteConfig.footerNav.product.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-muted transition-colors hover:text-ink"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
              Audiences
            </p>
            <ul className="mt-4 space-y-2.5">
              {siteConfig.footerNav.audiences.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-muted transition-colors hover:text-ink"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
              Foundation
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-muted">
              <li>Role-based access</li>
              <li>Moderated publishing</li>
              <li>Audit-ready operations</li>
            </ul>
            <a
              href="#top"
              className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink transition-colors hover:text-forest"
            >
              Back to top
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 pt-6 text-[10px] leading-5 text-muted sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} CampusPulse. Built for multi-college campuses.</p>
          <p>Demonstration data is fictional. Production deployment remains owner-gated.</p>
        </div>
      </Container>
    </footer>
  );
}

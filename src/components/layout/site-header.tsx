"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-canvas/90 backdrop-blur-md">
      <Container className="flex h-[4.5rem] items-center justify-between gap-6">
        <a
          href="#top"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
          aria-label={`${siteConfig.name} home`}
        >
          <BrandMark className="size-8 text-ink" />
          <span className="flex flex-col">
            <span className="text-[15px] font-bold leading-none tracking-[-0.03em] text-ink">
              {siteConfig.name}
            </span>
            <span className="mt-1 hidden text-[8px] font-bold uppercase leading-none tracking-[0.16em] text-muted sm:block">
              Campus event infrastructure
            </span>
          </span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {siteConfig.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative py-2 text-[12px] font-semibold text-muted transition-colors hover:text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform hover:after:scale-x-100"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Badge variant="outline" className="hidden xl:inline-flex">
            <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
            Four role workspaces
          </Badge>
          <ButtonLink href="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/register" size="sm">
            Create account
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </ButtonLink>
        </div>

        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isOpen}
          aria-controls="mobile-navigation"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsOpen((value) => !value)}
          className="grid size-10 place-items-center rounded-md border border-line-strong text-ink transition-colors hover:border-ink hover:bg-paper-dim lg:hidden"
        >
          {isOpen ? (
            <X aria-hidden="true" className="size-4" />
          ) : (
            <Menu aria-hidden="true" className="size-4" />
          )}
        </button>
      </Container>

      {isOpen ? (
        <div
          id="mobile-navigation"
          ref={menuRef}
          className="border-t border-line bg-paper px-5 py-5 shadow-float lg:hidden"
        >
          <nav aria-label="Mobile primary" className="flex flex-col">
            {siteConfig.nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between border-b border-line py-3.5 text-sm font-semibold text-ink last:border-b-0"
              >
                {item.label}
                <ArrowUpRight aria-hidden="true" className="size-3.5 text-muted" />
              </a>
            ))}
          </nav>
          <div className="mt-4 grid gap-2">
            <ButtonLink href="/register" className="w-full" onClick={() => setIsOpen(false)}>
              Create a student account
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </ButtonLink>
            <ButtonLink
              href="/login"
              variant="outline"
              className="w-full"
              onClick={() => setIsOpen(false)}
            >
              Sign in
            </ButtonLink>
          </div>
        </div>
      ) : null}
    </header>
  );
}

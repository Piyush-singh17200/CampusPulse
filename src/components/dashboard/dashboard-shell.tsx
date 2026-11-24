"use client";

import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Bookmark,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  Ticket,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { Button, buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/features/auth/actions";

export type DashboardIcon =
  | "overview"
  | "discover"
  | "calendar"
  | "saved"
  | "ticket"
  | "bell"
  | "profile"
  | "events"
  | "create"
  | "attendance"
  | "feedback"
  | "analytics"
  | "audit"
  | "settings"
  | "clubs"
  | "users"
  | "college"
  | "platform";

const icons = {
  overview: LayoutDashboard,
  discover: Compass,
  calendar: CalendarDays,
  saved: Bookmark,
  ticket: Ticket,
  bell: Bell,
  profile: UserRound,
  events: ClipboardList,
  create: Plus,
  attendance: ClipboardCheck,
  feedback: MessageSquareText,
  analytics: BarChart3,
  audit: ScrollText,
  settings: Settings,
  clubs: UsersRound,
  users: UsersRound,
  college: Building2,
  platform: ShieldCheck,
} satisfies Record<DashboardIcon, typeof LayoutDashboard>;

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: DashboardIcon;
  exact?: boolean;
  group?: string;
};

type DashboardShellProps = {
  roleLabel: string;
  userName: string;
  userEmail: string;
  collegeName: string;
  navItems: DashboardNavItem[];
  children: ReactNode;
  tone?: "forest" | "signal" | "ink";
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isActive(pathname: string, item: DashboardNavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function DashboardShell({
  roleLabel,
  userName,
  userEmail,
  collegeName,
  navItems,
  children,
  tone = "forest",
}: DashboardShellProps) {
  const pathname = usePathname();
  const [openAtPath, setOpenAtPath] = useState<string | null>(null);
  const open = openAtPath === pathname;
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  const closeMobileNav = () => {
    setOpenAtPath(null);
    requestAnimationFrame(() => mobileTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobilePanelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenAtPath(null);
        requestAnimationFrame(() => mobileTriggerRef.current?.focus());
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activeItem = [...navItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isActive(pathname, item));
  const activeTone = {
    forest: "bg-forest text-paper",
    signal: "bg-signal text-ink",
    ink: "bg-ink text-paper",
  }[tone];
  const activeIconTone = {
    forest: "text-signal",
    signal: "text-ink",
    ink: "text-signal",
  }[tone];

  const toneClass = {
    forest: "bg-forest text-paper",
    signal: "bg-signal text-ink",
    ink: "bg-ink text-paper",
  }[tone];

  const sidebar = (
    <div className="flex h-full flex-col bg-paper">
      <div className="flex h-[4.5rem] items-center gap-2.5 border-b border-line px-5">
        <BrandMark className="size-8 text-ink" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-bold leading-none tracking-[-0.03em] text-ink">
            CampusPulse
          </span>
          <span className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            {roleLabel}
          </span>
        </div>
      </div>

      <div className={cn("relative mx-4 mt-4 overflow-hidden rounded-lg px-3.5 py-3", toneClass)}>
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-signal" />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] opacity-65">Workspace</p>
            <p className="mt-1 truncate text-sm font-semibold">{collegeName}</p>
          </div>
          <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full border border-current/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] opacity-75">
            <span className="size-1 rounded-full bg-signal" aria-hidden="true" />
            Live
          </span>
        </div>
        <p className="mt-1 text-[9px] font-medium opacity-55">Role-scoped · {roleLabel}</p>
      </div>

      <nav aria-label={`${roleLabel} navigation`} className="mt-4 flex-1 overflow-y-auto px-3 pb-5">
        <ul className="space-y-1">
          {navItems.map((item, index) => {
            const Icon = icons[item.icon];
            const active = isActive(pathname, item);
            const showGroup = Boolean(item.group && item.group !== navItems[index - 1]?.group);

            return (
              <Fragment key={item.href}>
                {showGroup ? (
                  <li
                    role="presentation"
                    className="px-3 pb-1 pt-4 text-[8px] font-bold uppercase tracking-[0.18em] text-muted first:pt-1"
                  >
                    {item.group}
                  </li>
                ) : null}
                <li>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
                      active ? activeTone : "text-ink-soft hover:bg-paper-dim/80 hover:text-ink",
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-signal"
                      />
                    ) : null}
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        active ? activeIconTone : "text-muted group-hover:text-forest",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              </Fragment>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage text-[11px] font-bold text-ink">
            {initials(userName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{userName}</p>
            <p className="truncate text-[11px] text-muted">{userEmail}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-line bg-paper text-[11px] font-semibold text-ink transition-colors hover:border-ink hover:bg-paper-dim/60"
          >
            Public site
            <ArrowUpRight aria-hidden="true" className="size-3" />
          </Link>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" className="w-full text-[11px]">
              <LogOut aria-hidden="true" className="size-3.5" />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-paper"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line lg:block">
        {sidebar}
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[4.5rem] items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-md sm:px-6 lg:hidden">
          <Link href={navItems[0]?.href ?? "/"} className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="size-7 text-ink" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold leading-none tracking-[-0.03em]">
                CampusPulse
              </span>
              <span className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
                {activeItem?.label ?? roleLabel}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Open public site"
              className="grid size-9 place-items-center rounded-md border border-line bg-paper text-ink transition-colors hover:border-ink"
            >
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
            <button
              ref={mobileTriggerRef}
              type="button"
              aria-label="Open navigation"
              aria-expanded={open}
              aria-controls="dashboard-mobile-nav"
              onClick={() => setOpenAtPath(pathname)}
              className={buttonStyles({ variant: "outline", size: "icon" })}
            >
              <Menu aria-hidden="true" className="size-5" />
            </button>
          </div>
        </header>

        <div className="sticky top-0 z-20 hidden h-14 items-center justify-between gap-6 border-b border-line bg-canvas/85 px-10 backdrop-blur-md lg:flex">
          <div className="flex min-w-0 items-center gap-2 text-[11px]">
            <span className="font-bold text-ink">CampusPulse</span>
            <span className="text-line-strong" aria-hidden="true">
              /
            </span>
            <span className="text-muted">{roleLabel}</span>
            {activeItem ? (
              <>
                <span className="text-line-strong" aria-hidden="true">
                  /
                </span>
                <span className="truncate font-semibold text-ink">{activeItem.label}</span>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              {collegeName} · signed in
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink transition-colors hover:text-forest"
            >
              Public site
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </div>

        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
              onClick={closeMobileNav}
            />
            <div
              id="dashboard-mobile-nav"
              ref={mobilePanelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Dashboard navigation"
              className="absolute inset-y-0 left-0 w-[min(20rem,88vw)] shadow-float motion-safe:animate-[dashboard-slide-in_180ms_ease-out]"
            >
              <div className="absolute right-3 top-3 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation"
                  onClick={closeMobileNav}
                >
                  <X aria-hidden="true" className="size-5" />
                </Button>
              </div>
              {sidebar}
            </div>
          </div>
        ) : null}

        <main
          id="dashboard-main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1500px] px-4 py-6 focus:outline-none sm:px-6 lg:px-10 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

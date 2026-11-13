"use client";

import {
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
import { useEffect, useState, type ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenAtPath(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

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

      <div className={cn("mx-4 mt-4 rounded-lg px-3.5 py-3", toneClass)}>
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] opacity-65">Workspace</p>
        <p className="mt-1 truncate text-sm font-semibold">{collegeName}</p>
      </div>

      <nav aria-label={`${roleLabel} navigation`} className="mt-5 flex-1 overflow-y-auto px-3 pb-5">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = icons[item.icon];
            const active = isActive(pathname, item);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
                    active
                      ? "bg-ink text-paper"
                      : "text-ink-soft hover:bg-paper-dim/80 hover:text-ink",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      active ? "text-signal" : "text-muted group-hover:text-forest",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
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
        <form action={logoutAction} className="mt-3">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            <LogOut aria-hidden="true" className="size-3.5" />
            Sign out
          </Button>
        </form>
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
          <Link href={navItems[0]?.href ?? "/"} className="flex items-center gap-2.5">
            <BrandMark className="size-7 text-ink" />
            <span className="text-sm font-bold tracking-[-0.03em]">CampusPulse</span>
          </Link>
          <Button
            variant="outline"
            size="icon"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="dashboard-mobile-nav"
            onClick={() => setOpenAtPath(pathname)}
          >
            <Menu aria-hidden="true" className="size-5" />
          </Button>
        </header>

        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
              onClick={() => setOpenAtPath(null)}
            />
            <div
              id="dashboard-mobile-nav"
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
                  onClick={() => setOpenAtPath(null)}
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
          className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

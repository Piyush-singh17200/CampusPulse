import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-line pb-6", className)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
            <span className="h-px w-7 bg-forest/40" />
            {eyebrow}
          </p>
          <h1 className="mt-3 text-balance font-display text-[clamp(2rem,4vw,3.2rem)] leading-[0.98] tracking-[-0.03em] text-ink">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-[13px] leading-6 text-muted sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-line bg-paper shadow-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "forest" | "signal" | "ink";
}) {
  const toneClasses = {
    default: "bg-paper text-ink",
    forest: "bg-forest text-paper",
    signal: "bg-signal text-ink",
    ink: "bg-ink text-paper",
  }[tone];

  const mutedClasses = {
    default: "text-muted",
    forest: "text-paper/65",
    signal: "text-ink/60",
    ink: "text-paper/60",
  }[tone];

  return (
    <div className={cn("rounded-xl border border-line p-4 shadow-card sm:p-5", toneClasses)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[10px] font-bold uppercase tracking-[0.15em]", mutedClasses)}>
          {label}
        </p>
        {icon ? <span className={cn("shrink-0", mutedClasses)}>{icon}</span> : null}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{value}</p>
      {detail ? <div className={cn("mt-2 text-xs leading-5", mutedClasses)}>{detail}</div> : null}
    </div>
  );
}

export function BarList({
  title,
  items,
  emptyLabel = "No data yet.",
  valueLabel = "Count",
}: {
  title: string;
  items: { label: string; value: number; detail?: string }[];
  emptyLabel?: string;
  valueLabel?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">{title}</p>
      {items.length ? (
        <>
          <ul className="mt-4 space-y-3" aria-label={title}>
            {items.map((item) => (
              <li key={item.label}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate font-semibold text-ink-soft">{item.label}</span>
                  <span className="shrink-0 font-bold text-ink">{item.value}</span>
                </div>
                <svg
                  className="mt-1.5 h-1.5 w-full"
                  viewBox="0 0 100 6"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <rect
                    width="100"
                    height="6"
                    rx="3"
                    fill="currentColor"
                    className="text-paper-dim"
                  />
                  <rect
                    width={Math.max((item.value / max) * 100, item.value ? 4 : 0)}
                    height="6"
                    rx="3"
                    fill="currentColor"
                    className="text-forest"
                  />
                </svg>
                {item.detail ? <p className="mt-1 text-[11px] text-muted">{item.detail}</p> : null}
              </li>
            ))}
          </ul>
          <table className="sr-only">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.label}>
                  <th scope="row">{item.label}</th>
                  <td>{item.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-line-strong px-3 py-6 text-center text-xs text-muted">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

export function InlineMeta({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-line bg-paper px-3.5 py-3">
          <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

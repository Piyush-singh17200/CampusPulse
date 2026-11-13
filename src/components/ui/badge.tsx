import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "outline" | "signal" | "forest" | "sage" | "dark" | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-ink text-paper",
  outline: "border border-line-strong bg-transparent text-ink-soft",
  signal: "bg-signal/15 text-signal-dark",
  forest: "bg-forest-soft text-forest",
  sage: "bg-sage text-ink-soft",
  dark: "border border-paper/15 bg-paper/10 text-paper",
  muted: "bg-paper-dim text-muted",
};

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.13em]",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

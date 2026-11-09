import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "signal" | "outline" | "ghost" | "subtle" | "inverse";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft active:bg-ink disabled:hover:bg-ink",
  signal:
    "bg-signal text-ink hover:bg-[#ef6a45] active:bg-signal-dark active:text-paper disabled:hover:bg-signal",
  outline:
    "border border-line-strong bg-transparent text-ink hover:border-ink hover:bg-paper-dim/60",
  ghost: "bg-transparent text-ink-soft hover:bg-paper-dim/70 hover:text-ink",
  subtle: "border border-line bg-paper text-ink hover:bg-paper-dim/60",
  inverse:
    "border border-paper/25 bg-transparent text-paper hover:border-paper/60 hover:bg-paper/10",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "size-10",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold tracking-[-0.01em] transition-[background-color,border-color,color,transform] duration-200 disabled:pointer-events-none disabled:opacity-45",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}

type ButtonLinkProps = ComponentPropsWithoutRef<"a"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <a className={buttonStyles({ variant, size, className })} {...props} />;
}

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type SectionHeadingProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  className,
}: SectionHeadingProps) {
  const isDark = tone === "dark";

  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      <p
        className={cn(
          "flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em]",
          align === "center" && "justify-center",
          isDark ? "text-signal" : "text-forest",
        )}
      >
        <span className={cn("h-px w-7", isDark ? "bg-signal/60" : "bg-forest/40")} />
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-5 text-balance font-display text-[clamp(2.4rem,5vw,4.5rem)] leading-[0.98] tracking-[-0.02em]",
          isDark ? "text-paper" : "text-ink",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-5 max-w-2xl text-[15px] leading-7 sm:text-base",
            align === "center" && "mx-auto",
            isDark ? "text-paper/65" : "text-muted",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

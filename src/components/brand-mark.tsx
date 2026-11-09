import { cn } from "@/lib/cn";

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={cn("size-9 shrink-0", className)}
    >
      <rect width="40" height="40" rx="9" fill="currentColor" />
      <path
        d="M8 22.5h5.4l2.6-7.7 4.4 12.4 2.8-5.4H32"
        stroke="var(--color-paper)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="21.8" r="1.9" fill="var(--color-signal)" />
    </svg>
  );
}

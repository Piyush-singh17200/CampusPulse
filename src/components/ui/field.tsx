import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

type FieldProps = {
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({
  id,
  label,
  description,
  error,
  required,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="flex items-center gap-1 text-[13px] font-semibold text-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-signal-dark">
            *
          </span>
        ) : null}
      </label>
      {children}
      {description ? (
        <p id={`${id}-description`} className="text-xs leading-5 text-muted">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium leading-5 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const controlClasses =
  "block w-full rounded-md border border-line-strong bg-paper px-3.5 text-sm text-ink shadow-[inset_0_1px_0_rgb(255_255_255_/_0.6)] transition-colors placeholder:text-muted/70 hover:border-ink/40 focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:bg-paper-dim disabled:text-muted aria-invalid:border-danger";

type InputProps = ComponentPropsWithoutRef<"input"> & {
  invalid?: boolean;
};

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(controlClasses, "h-11", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

type TextareaProps = ComponentPropsWithoutRef<"textarea"> & {
  invalid?: boolean;
};

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(controlClasses, "min-h-28 resize-y py-3 leading-6", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

type SelectProps = ComponentPropsWithoutRef<"select"> & {
  invalid?: boolean;
};

export function Select({ className, invalid, ...props }: SelectProps) {
  return (
    <select
      className={cn(controlClasses, "h-11 pr-9", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

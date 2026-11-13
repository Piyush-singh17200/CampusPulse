"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/features/dashboards/types";

type DashboardAction = (
  state: DashboardActionState,
  formData: FormData,
) => Promise<DashboardActionState>;

type ActionVariant = ComponentProps<typeof Button>["variant"];
type ActionSize = ComponentProps<typeof Button>["size"];

export function ActionMessage({
  state,
  className,
}: {
  state: DashboardActionState;
  className?: string;
}) {
  if (!state.message) {
    return null;
  }

  const error = state.status === "error";

  return (
    <p
      role={error ? "alert" : "status"}
      aria-live="polite"
      className={cn("text-xs leading-5", error ? "text-danger" : "text-forest", className)}
    >
      {state.message}
    </p>
  );
}

export function ActionForm({
  action,
  fields = {},
  submitLabel,
  pendingLabel = "Working…",
  variant = "primary",
  size = "sm",
  className,
  children,
  showMessage = true,
  disabled = false,
}: {
  action: DashboardAction;
  fields?: Record<string, string | number | null | undefined>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: ActionVariant;
  size?: ActionSize;
  className?: string;
  children?: ReactNode;
  showMessage?: boolean;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialDashboardActionState);

  return (
    <form action={formAction} className={cn("space-y-2", className)}>
      {Object.entries(fields).map(([name, value]) =>
        value === null || value === undefined ? null : (
          <input key={name} type="hidden" name={name} value={String(value)} />
        ),
      )}
      {children}
      <Button type="submit" variant={variant} size={size} disabled={pending || disabled}>
        {pending ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : null}
        {pending ? pendingLabel : submitLabel}
      </Button>
      {showMessage ? <ActionMessage state={state} /> : null}
    </form>
  );
}

export function ReasonActionForm({
  action,
  fields = {},
  label,
  placeholder,
  submitLabel,
  pendingLabel = "Saving…",
  variant = "signal",
  size = "sm",
  required = true,
}: {
  action: DashboardAction;
  fields?: Record<string, string | number | null | undefined>;
  label: string;
  placeholder?: string;
  submitLabel: string;
  pendingLabel?: string;
  variant?: ActionVariant;
  size?: ActionSize;
  required?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialDashboardActionState);

  return (
    <form action={formAction} className="space-y-3">
      {Object.entries(fields).map(([name, value]) =>
        value === null || value === undefined ? null : (
          <input key={name} type="hidden" name={name} value={String(value)} />
        ),
      )}
      <label className="block">
        <span className="text-[11px] font-semibold text-ink-soft">{label}</span>
        <textarea
          name="reason"
          required={required}
          rows={3}
          placeholder={placeholder}
          className="mt-1.5 w-full rounded-md border border-line-strong bg-paper px-3 py-2 text-[13px] text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
        />
      </label>
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : null}
        {pending ? pendingLabel : submitLabel}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}

export function SelectActionForm({
  action,
  fields = {},
  selectName,
  label,
  options,
  defaultValue,
  submitLabel,
  pendingLabel = "Updating…",
  variant = "outline",
  size = "sm",
  disabled = false,
}: {
  action: DashboardAction;
  fields?: Record<string, string | number | null | undefined>;
  selectName: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  submitLabel: string;
  pendingLabel?: string;
  variant?: ActionVariant;
  size?: ActionSize;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialDashboardActionState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      {Object.entries(fields).map(([name, value]) =>
        value === null || value === undefined ? null : (
          <input key={name} type="hidden" name={name} value={String(value)} />
        ),
      )}
      <label className="min-w-36 flex-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
          {label}
        </span>
        <select
          name={selectName}
          defaultValue={defaultValue}
          disabled={disabled || pending}
          className="mt-1 h-9 w-full rounded-md border border-line-strong bg-paper px-2 text-[12px] font-semibold text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant={variant} size={size} disabled={pending || disabled}>
        {pending ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : null}
        {pending ? pendingLabel : submitLabel}
      </Button>
      <ActionMessage state={state} className="w-full" />
    </form>
  );
}

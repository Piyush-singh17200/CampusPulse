"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { changePasswordAction } from "@/features/auth/actions";
import type { AuthActionState } from "@/features/auth/types";

const initialState: AuthActionState = {
  status: "idle",
};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.message ? (
        <div
          role={state.status === "error" ? "alert" : "status"}
          className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs leading-5 ${
            state.status === "success"
              ? "border-forest/30 bg-forest-soft/40 text-forest"
              : "border-signal/30 bg-signal/5 text-signal-dark"
          }`}
        >
          {state.status === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <span>{state.message}</span>
        </div>
      ) : null}

      <div>
        <label
          htmlFor="currentPassword"
          className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          placeholder="••••••••••••"
          className="mt-1.5 w-full rounded-md border border-line-strong bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15 disabled:opacity-60"
        />
        {state.fieldErrors?.currentPassword ? (
          <p className="mt-1 text-xs text-signal-dark">{state.fieldErrors.currentPassword[0]}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="newPassword"
            className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted"
          >
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending}
            placeholder="At least 12 characters"
            className="mt-1.5 w-full rounded-md border border-line-strong bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15 disabled:opacity-60"
          />
          {state.fieldErrors?.newPassword ? (
            <p className="mt-1 text-xs text-signal-dark">{state.fieldErrors.newPassword[0]}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted"
          >
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending}
            placeholder="Repeat new password"
            className="mt-1.5 w-full rounded-md border border-line-strong bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15 disabled:opacity-60"
          />
          {state.fieldErrors?.confirmPassword ? (
            <p className="mt-1 text-xs text-signal-dark">{state.fieldErrors.confirmPassword[0]}</p>
          ) : null}
        </div>
      </div>

      <p className="text-[11px] leading-5 text-muted">
        Must be at least 12 characters with an uppercase letter, lowercase letter, number, and
        symbol.
      </p>

      <div className="pt-2">
        <Button type="submit" variant="signal" size="sm" disabled={pending}>
          <KeyRound className="size-3.5" aria-hidden="true" />
          {pending ? "Updating password…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}

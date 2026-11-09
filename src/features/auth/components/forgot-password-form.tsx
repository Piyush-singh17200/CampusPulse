"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, Input } from "@/components/ui/field";
import { forgotPasswordAction } from "@/features/auth/actions";
import { FormMessage, SubmitButton } from "@/features/auth/components/form-feedback";
import { initialAuthState } from "@/features/auth/types";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialAuthState);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />

      {state.devResetUrl ? (
        <div className="rounded-md border border-signal/30 bg-signal/10 px-3.5 py-3 text-[13px] leading-5 text-ink-soft">
          <p className="font-semibold text-ink">Development email is disabled.</p>
          <p className="mt-1">
            SMTP is not configured, so this local reset link is shown only outside production.
          </p>
          <a
            href={state.devResetUrl}
            className="mt-2 inline-flex font-semibold text-forest underline underline-offset-4"
          >
            Open development reset link
          </a>
        </div>
      ) : null}

      <Field id="email" label="Email address" error={errors?.email?.[0]} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email ?? ""}
          invalid={Boolean(errors?.email)}
          aria-describedby={errors?.email ? "email-error" : undefined}
          placeholder="you@college.edu"
        />
      </Field>

      <p className="text-[12px] leading-5 text-muted">
        For privacy, we do not confirm whether an account exists. If one does, a reset link will be
        sent to that address.
      </p>

      <SubmitButton pending={pending}>
        {pending ? "Preparing reset link…" : "Send reset link"}
      </SubmitButton>

      <p className="text-center text-[12px] leading-5 text-muted">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="font-semibold text-forest underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

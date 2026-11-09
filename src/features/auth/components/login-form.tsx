"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, Input } from "@/components/ui/field";
import { loginAction } from "@/features/auth/actions";
import { FormMessage, SubmitButton } from "@/features/auth/components/form-feedback";
import { PasswordInput } from "@/features/auth/components/password-input";
import { initialAuthState } from "@/features/auth/types";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialAuthState);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {notice ? (
        <div
          role="status"
          className="rounded-md border border-forest/20 bg-forest-soft/50 px-3.5 py-3 text-[13px] leading-5 text-forest"
        >
          {notice}
        </div>
      ) : null}

      <FormMessage state={state} />

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

      <Field id="password" label="Password" error={errors?.password?.[0]} required>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          invalid={Boolean(errors?.password)}
          describedBy={errors?.password ? "password-error" : undefined}
          placeholder="Your password"
        />
      </Field>

      <div className="flex items-center justify-between gap-4 text-[12px]">
        <Link
          href="/forgot-password"
          className="font-semibold text-forest underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
        <span className="text-muted">Secure server session</span>
      </div>

      <SubmitButton pending={pending}>{pending ? "Signing in…" : "Sign in"}</SubmitButton>

      <p className="text-center text-[12px] leading-5 text-muted">
        New to CampusPulse?{" "}
        <Link
          href="/register"
          className="font-semibold text-forest underline-offset-4 hover:underline"
        >
          Create a student account
        </Link>
      </p>
    </form>
  );
}

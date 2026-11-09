"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field } from "@/components/ui/field";
import { resetPasswordAction } from "@/features/auth/actions";
import { FormMessage, SubmitButton } from "@/features/auth/components/form-feedback";
import { PasswordInput } from "@/features/auth/components/password-input";
import { initialAuthState } from "@/features/auth/types";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialAuthState);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />

      <Field
        id="password"
        label="New password"
        description="At least 12 characters, including upper and lowercase letters, a number, and a symbol."
        error={errors?.password?.[0]}
        required
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          invalid={Boolean(errors?.password)}
          describedBy={errors?.password ? "password-error" : "password-description"}
          placeholder="Create a new password"
        />
      </Field>

      <Field
        id="confirmPassword"
        label="Confirm new password"
        error={errors?.confirmPassword?.[0]}
        required
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          invalid={Boolean(errors?.confirmPassword)}
          describedBy={errors?.confirmPassword ? "confirmPassword-error" : undefined}
          placeholder="Repeat your new password"
        />
      </Field>

      <p className="text-[12px] leading-5 text-muted">
        Resetting your password signs out every existing session for this account.
      </p>

      <SubmitButton pending={pending}>
        {pending ? "Updating password…" : "Update password"}
      </SubmitButton>

      <p className="text-center text-[12px] leading-5 text-muted">
        Need a fresh link?{" "}
        <Link
          href="/forgot-password"
          className="font-semibold text-forest underline-offset-4 hover:underline"
        >
          Request another reset email
        </Link>
      </p>
    </form>
  );
}

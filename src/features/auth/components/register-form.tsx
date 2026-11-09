"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, Input, Select } from "@/components/ui/field";
import { registerAction } from "@/features/auth/actions";
import { FormMessage, SubmitButton } from "@/features/auth/components/form-feedback";
import { PasswordInput } from "@/features/auth/components/password-input";
import { initialAuthState } from "@/features/auth/types";

export type CollegeOption = {
  id: string;
  name: string;
  shortName: string | null;
};

export function RegisterForm({ colleges }: { colleges: CollegeOption[] }) {
  const [state, formAction, pending] = useActionState(registerAction, initialAuthState);
  const errors = state.fieldErrors;
  const registrationUnavailable = colleges.length === 0;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />

      {registrationUnavailable ? (
        <div className="rounded-md border border-line bg-paper-dim px-3.5 py-3 text-[13px] leading-5 text-muted">
          Student registration is temporarily unavailable because no active colleges are configured.
          Please contact your college administrator.
        </div>
      ) : null}

      <Field id="name" label="Full name" error={errors?.name?.[0]} required>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          defaultValue={state.values?.name ?? ""}
          invalid={Boolean(errors?.name)}
          aria-describedby={errors?.name ? "name-error" : undefined}
          placeholder="Your full name"
        />
      </Field>

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

      <Field id="collegeId" label="College" error={errors?.collegeId?.[0]} required>
        <Select
          id="collegeId"
          name="collegeId"
          required
          defaultValue={state.values?.collegeId ?? ""}
          invalid={Boolean(errors?.collegeId)}
          aria-describedby={errors?.collegeId ? "collegeId-error" : undefined}
          disabled={registrationUnavailable}
        >
          <option value="" disabled>
            Select your college
          </option>
          {colleges.map((college) => (
            <option key={college.id} value={college.id}>
              {college.name}
              {college.shortName ? ` (${college.shortName})` : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        id="password"
        label="Password"
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
          placeholder="Create a strong password"
        />
      </Field>

      <Field
        id="confirmPassword"
        label="Confirm password"
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
          placeholder="Repeat your password"
        />
      </Field>

      <SubmitButton pending={pending || registrationUnavailable}>
        {pending ? "Creating account…" : "Create student account"}
      </SubmitButton>

      <p className="text-center text-[12px] leading-5 text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-forest underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

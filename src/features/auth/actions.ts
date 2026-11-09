"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/server/db/client";
import { DomainError, InvalidResetTokenError } from "@/server/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { auth } from "@/server/auth/auth";
import { burnPasswordHash } from "@/server/auth/password";
import { requestPasswordReset, resetPasswordWithToken } from "@/server/auth/password-reset";
import { registerStudent } from "@/server/auth/registration";
import { getRequestIdentity, hashIp } from "@/server/auth/request-context";
import { RATE_LIMITS, consumeRateLimit } from "@/server/auth/rate-limit";
import { recordAuthAuditEvent } from "@/server/auth/audit";
import { getCurrentUser } from "@/server/auth/session";
import {
  forgotPasswordSchema,
  loginSchema,
  normalizeEmail,
  registrationSchema,
  resetPasswordSchema,
} from "@/server/auth/validation";
import type { AuthActionState, AuthFieldErrors } from "@/features/auth/types";

function toFieldErrors(error: z.ZodError): AuthFieldErrors {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const result: AuthFieldErrors = {};

  for (const [key, messages] of Object.entries(flattened)) {
    if (messages && messages.length > 0) {
      result[key] = messages;
    }
  }

  return result;
}

function errorState(message: string, fieldErrors?: AuthFieldErrors): AuthActionState {
  return { status: "error", message, fieldErrors };
}

function rateLimitState(): AuthActionState {
  return errorState("Too many attempts. Please wait a few minutes and try again.");
}

function stringValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    await assertSameOrigin();
  } catch {
    return errorState("We could not verify this request. Refresh the page and try again.");
  }

  const values = {
    name: stringValue(formData, "name"),
    email: stringValue(formData, "email"),
    collegeId: stringValue(formData, "collegeId"),
  };

  const parsed = registrationSchema.safeParse({
    ...values,
    password: stringValue(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: toFieldErrors(parsed.error),
      values,
    };
  }

  if (stringValue(formData, "password") !== stringValue(formData, "confirmPassword")) {
    return {
      status: "error",
      message: "The passwords do not match.",
      fieldErrors: { confirmPassword: ["The passwords do not match."] },
      values,
    };
  }

  const identity = await getRequestIdentity();
  const auditContext = {
    ipHash: hashIp(identity.ip),
    userAgent: identity.userAgent,
  };

  const ipLimit = await consumeRateLimit(RATE_LIMITS.registrationIp, identity.ip);
  const emailLimit = await consumeRateLimit(RATE_LIMITS.registrationEmail, values.email);

  if (!ipLimit.allowed || !emailLimit.allowed) {
    return rateLimitState();
  }

  try {
    await registerStudent(parsed.data, auditContext);
  } catch (error) {
    if (error instanceof DomainError) {
      if (error.code === "ACCOUNT_EXISTS") {
        return {
          status: "error",
          message: error.message,
          fieldErrors: { email: [error.message] },
          values,
        };
      }

      return {
        status: "error",
        message: error.message,
        values,
      };
    }

    return errorState("We could not create your account. Please try again.", {
      email: ["Please try again or use a different email address."],
    });
  }

  try {
    await auth.api.signInEmail({
      body: {
        email: normalizeEmail(parsed.data.email),
        password: parsed.data.password,
        rememberMe: true,
      },
      headers: await headers(),
    });
  } catch {
    redirect("/login?registered=1");
  }

  redirect("/account");
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    await assertSameOrigin();
  } catch {
    return errorState("We could not verify this request. Refresh the page and try again.");
  }

  const values = {
    email: stringValue(formData, "email"),
  };
  const parsed = loginSchema.safeParse({
    email: values.email,
    password: stringValue(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: toFieldErrors(parsed.error),
      values,
    };
  }

  const email = normalizeEmail(parsed.data.email);
  const identity = await getRequestIdentity();
  const auditContext = {
    ipHash: hashIp(identity.ip),
    userAgent: identity.userAgent,
  };
  const emailLimit = await consumeRateLimit(RATE_LIMITS.loginEmail, email);
  const ipLimit = await consumeRateLimit(RATE_LIMITS.loginIp, identity.ip);

  if (!emailLimit.allowed || !ipLimit.allowed) {
    return rateLimitState();
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, collegeId: true, status: true, deletedAt: true },
  });

  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    // Burn comparable Argon2id work for unknown and inactive accounts. The
    // response is identical so account state cannot be enumerated.
    await burnPasswordHash(parsed.data.password);
    await recordAuthAuditEvent({
      userId: user?.id ?? null,
      collegeId: user?.collegeId ?? null,
      event: "LOGIN_FAILED",
      email,
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
      metadata: { reason: "invalid_credentials" },
    });

    return errorState("Email or password is incorrect.");
  }

  try {
    await auth.api.signInEmail({
      body: {
        email,
        password: parsed.data.password,
        rememberMe: true,
      },
      headers: await headers(),
    });
  } catch {
    await recordAuthAuditEvent({
      userId: user.id,
      collegeId: user.collegeId,
      event: "LOGIN_FAILED",
      email,
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
      metadata: { reason: "invalid_credentials" },
    });

    return errorState("Email or password is incorrect.");
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });
    await recordAuthAuditEvent({
      userId: user.id,
      collegeId: user.collegeId,
      event: "LOGIN_SUCCEEDED",
      email,
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
    });
  } catch {
    // A successful authentication must not fail because a non-critical audit
    // or last-seen update failed.
  }

  redirect("/account");
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    await assertSameOrigin();
  } catch {
    return errorState("We could not verify this request. Refresh the page and try again.");
  }

  const emailInput = stringValue(formData, "email");
  const parsed = forgotPasswordSchema.safeParse({ email: emailInput });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      fieldErrors: toFieldErrors(parsed.error),
      values: { email: emailInput },
    };
  }

  const identity = await getRequestIdentity();
  const auditContext = {
    ipHash: hashIp(identity.ip),
    userAgent: identity.userAgent,
  };
  const emailLimit = await consumeRateLimit(RATE_LIMITS.passwordResetEmail, parsed.data.email);
  const ipLimit = await consumeRateLimit(RATE_LIMITS.passwordResetIp, identity.ip);

  if (!emailLimit.allowed || !ipLimit.allowed) {
    return rateLimitState();
  }

  try {
    const result = await requestPasswordReset(parsed.data, auditContext);

    return {
      status: "success",
      message:
        "If an account exists for that email, a password reset link has been prepared. Check your inbox and spam folder.",
      devResetUrl: result.devResetUrl,
    };
  } catch {
    return errorState("We could not process the reset request. Please try again.");
  }
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    await assertSameOrigin();
  } catch {
    return errorState("We could not verify this request. Refresh the page and try again.");
  }

  const token = stringValue(formData, "token");
  const password = stringValue(formData, "password");
  const confirmPassword = stringValue(formData, "confirmPassword");
  const parsed = resetPasswordSchema.safeParse({ token, password });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  if (password !== confirmPassword) {
    return {
      status: "error",
      message: "The passwords do not match.",
      fieldErrors: { confirmPassword: ["The passwords do not match."] },
    };
  }

  const identity = await getRequestIdentity();
  const ipLimit = await consumeRateLimit(RATE_LIMITS.passwordResetCompleteIp, identity.ip);

  if (!ipLimit.allowed) {
    return rateLimitState();
  }

  try {
    await resetPasswordWithToken(parsed.data, {
      ipHash: hashIp(identity.ip),
      userAgent: identity.userAgent,
    });
  } catch (error) {
    if (error instanceof InvalidResetTokenError) {
      return errorState(error.message);
    }

    return errorState("We could not reset your password. Please request a new link.");
  }

  try {
    // Best effort: the session rows are already deleted, but this also clears
    // the browser cookie for a user who reset from the same browser.
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // The reset already revoked every server-side session.
  }

  redirect("/login?reset=success");
}

export async function logoutAction(): Promise<void> {
  try {
    await assertSameOrigin();
  } catch {
    return;
  }

  const user = await getCurrentUser();

  if (user) {
    try {
      await recordAuthAuditEvent({
        userId: user.id,
        collegeId: user.collegeId,
        event: "LOGOUT",
        email: user.email,
      });
    } catch {
      // Logout must still complete if the audit write fails.
    }
  }

  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // The redirect still sends the user to a safe signed-out screen.
  }

  redirect("/login?loggedOut=1");
}

import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { env } from "@/config/env";
import { prisma } from "@/server/db/client";
import { runInTransaction } from "@/server/db/transactions";
import { InvalidResetTokenError } from "@/server/errors";
import { parseServiceInput } from "@/services/validation";

import { recordAuthAuditEvent, writeAuthAuditEvent } from "./audit";
import { hashPassword } from "./password";
import { isEmailDeliveryConfigured, sendPasswordResetEmail } from "@/server/email/email-service";
import { normalizeEmail, forgotPasswordSchema, resetPasswordSchema } from "./validation";
import { revokeAllSessionsForUser } from "./session-revocation";

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;

export type PasswordResetAuditContext = {
  ipHash?: string;
  userAgent?: string;
};

export type PasswordResetRequestResult = {
  /**
   * Only present outside production when SMTP is disabled. Production never
   * returns or logs a reset token.
   */
  devResetUrl?: string;
};

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildResetUrl(token: string): string {
  const url = new URL("/reset-password", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * Issues a single-use, short-lived reset token. Only its SHA-256 hash is stored.
 * A new request invalidates every previous unused token for the user.
 */
export async function requestPasswordReset(
  input: unknown,
  auditContext: PasswordResetAuditContext = {},
): Promise<PasswordResetRequestResult> {
  const data = parseServiceInput(forgotPasswordSchema, input);
  const email = normalizeEmail(data.email);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, collegeId: true, name: true, status: true, deletedAt: true },
  });

  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    // Keep the response generic. The event is still recorded, without a user
    // relationship, so unknown-email attempts remain auditable.
    await recordAuthAuditEvent({
      event: "PASSWORD_RESET_REQUESTED",
      email,
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
      metadata: { delivery: "none" },
    });

    return {};
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1_000);
  const delivery = isEmailDeliveryConfigured() ? "smtp" : "development";

  await runInTransaction(prisma, async (tx) => {
    const now = new Date();

    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await writeAuthAuditEvent(tx, {
      userId: user.id,
      collegeId: user.collegeId,
      event: "PASSWORD_RESET_REQUESTED",
      email,
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
      metadata: { delivery },
    });
  });

  if (isEmailDeliveryConfigured()) {
    try {
      await sendPasswordResetEmail({
        to: email,
        name: user.name,
        resetUrl: buildResetUrl(token),
        expiresInMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES,
      });
    } catch {
      // Delivery failures must not reveal whether the account exists. The
      // request is audited, and the caller still receives the generic response.
      await recordAuthAuditEvent({
        userId: user.id,
        collegeId: user.collegeId,
        event: "PASSWORD_RESET_FAILED",
        email,
        ipHash: auditContext.ipHash,
        userAgent: auditContext.userAgent,
        metadata: { reason: "email_delivery_failed" },
      });
    }

    return {};
  }

  if (process.env.NODE_ENV !== "production") {
    return { devResetUrl: buildResetUrl(token) };
  }

  return {};
}

export type PasswordResetCompletion = {
  userId: string;
};

/**
 * Atomically consumes a reset token, replaces the credential hash, invalidates
 * all other reset tokens, and revokes every session for the user.
 */
export async function resetPasswordWithToken(
  input: unknown,
  auditContext: PasswordResetAuditContext = {},
): Promise<PasswordResetCompletion> {
  const data = parseServiceInput(resetPasswordSchema, input);
  const tokenHash = hashResetToken(data.token);
  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: {
        select: { id: true, collegeId: true, status: true, deletedAt: true },
      },
    },
  });

  if (
    !tokenRecord ||
    tokenRecord.usedAt ||
    tokenRecord.expiresAt.getTime() <= Date.now() ||
    tokenRecord.user.deletedAt ||
    tokenRecord.user.status !== "ACTIVE"
  ) {
    await recordAuthAuditEvent({
      userId: tokenRecord?.userId ?? null,
      collegeId: tokenRecord?.user.collegeId ?? null,
      event: "PASSWORD_RESET_FAILED",
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
      metadata: { reason: "invalid_or_expired_token" },
    });

    throw new InvalidResetTokenError();
  }

  const passwordHash = await hashPassword(data.password);

  try {
    return await runInTransaction(prisma, async (tx) => {
      const now = new Date();
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: tokenRecord.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimed.count !== 1) {
        throw new InvalidResetTokenError();
      }

      const updatedAccount = await tx.account.updateMany({
        where: {
          userId: tokenRecord.userId,
          providerId: "credential",
          accountId: tokenRecord.userId,
        },
        data: { password: passwordHash },
      });

      if (updatedAccount.count !== 1) {
        throw new InvalidResetTokenError();
      }

      const revokedSessionCount = await revokeAllSessionsForUser(tx, tokenRecord.userId);

      await tx.passwordResetToken.updateMany({
        where: {
          userId: tokenRecord.userId,
          usedAt: null,
          id: { not: tokenRecord.id },
        },
        data: { usedAt: now },
      });

      await writeAuthAuditEvent(tx, {
        userId: tokenRecord.userId,
        collegeId: tokenRecord.user.collegeId,
        event: "PASSWORD_RESET_COMPLETED",
        ipHash: auditContext.ipHash,
        userAgent: auditContext.userAgent,
        metadata: { revokedCount: revokedSessionCount },
      });

      return { userId: tokenRecord.userId };
    });
  } catch (error) {
    if (error instanceof InvalidResetTokenError) {
      await recordAuthAuditEvent({
        userId: tokenRecord.userId,
        collegeId: tokenRecord.user.collegeId,
        event: "PASSWORD_RESET_FAILED",
        ipHash: auditContext.ipHash,
        userAgent: auditContext.userAgent,
        metadata: { reason: "token_consumed" },
      });
    }

    throw error;
  }
}

import "server-only";

import { prisma } from "@/server/db/client";

import { rateLimitKey } from "./request-context";

export type RateLimitPolicy = {
  namespace: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: Date;
};

export const RATE_LIMITS = {
  loginEmail: { namespace: "login-email", limit: 5, windowSeconds: 15 * 60 },
  loginIp: { namespace: "login-ip", limit: 20, windowSeconds: 15 * 60 },
  registrationIp: { namespace: "registration-ip", limit: 5, windowSeconds: 60 * 60 },
  registrationEmail: { namespace: "registration-email", limit: 3, windowSeconds: 60 * 60 },
  passwordResetEmail: { namespace: "password-reset-email", limit: 3, windowSeconds: 60 * 60 },
  passwordResetIp: { namespace: "password-reset-ip", limit: 10, windowSeconds: 60 * 60 },
  passwordResetCompleteIp: {
    namespace: "password-reset-complete-ip",
    limit: 10,
    windowSeconds: 60 * 60,
  },
} as const satisfies Record<string, RateLimitPolicy>;

type RateLimitRow = {
  count: number;
  expiresAt: Date;
};

/**
 * Atomically increments a fixed-window counter in PostgreSQL.
 *
 * A single INSERT ... ON CONFLICT statement makes concurrent attempts safe;
 * an in-memory limiter would be bypassable across processes and deployments.
 */
export async function consumeRateLimit(
  policy: RateLimitPolicy,
  value: string,
): Promise<RateLimitResult> {
  const key = rateLimitKey(policy.namespace, value.trim().toLowerCase() || "unknown");

  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    INSERT INTO "rate_limit_entries" (
      "key",
      "count",
      "windowStartedAt",
      "expiresAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${key},
      1,
      NOW(),
      NOW() + make_interval(secs => ${policy.windowSeconds}),
      NOW(),
      NOW()
    )
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_entries"."expiresAt" <= NOW() THEN 1
        ELSE "rate_limit_entries"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "rate_limit_entries"."expiresAt" <= NOW() THEN NOW()
        ELSE "rate_limit_entries"."windowStartedAt"
      END,
      "expiresAt" = CASE
        WHEN "rate_limit_entries"."expiresAt" <= NOW()
          THEN NOW() + make_interval(secs => ${policy.windowSeconds})
        ELSE "rate_limit_entries"."expiresAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "expiresAt"
  `;

  const row = rows[0];

  if (!row) {
    // A database failure must fail closed for authentication operations.
    return {
      allowed: false,
      limit: policy.limit,
      remaining: 0,
      retryAfterSeconds: policy.windowSeconds,
      resetAt: new Date(Date.now() + policy.windowSeconds * 1_000),
    };
  }

  const count = Number(row.count);
  const allowed = count <= policy.limit;
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((row.expiresAt.getTime() - Date.now()) / 1_000));

  return {
    allowed,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    retryAfterSeconds,
    resetAt: row.expiresAt,
  };
}

export async function pruneExpiredRateLimits(olderThanMs = 24 * 60 * 60 * 1_000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.rateLimitEntry.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  return result.count;
}

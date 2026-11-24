import "server-only";

import { prisma } from "@/server/db/client";
import { RateLimitedError } from "@/server/errors";

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
  // Authenticated, expensive or abuse-prone application operations. These are
  // keyed by user ID and are deliberately generous for normal use while still
  // bounding CPU, storage, export, and write amplification.
  posterUploadUser: { namespace: "poster-upload-user", limit: 20, windowSeconds: 10 * 60 },
  posterOcrUser: { namespace: "poster-ocr-user", limit: 10, windowSeconds: 10 * 60 },
  posterReadUser: { namespace: "poster-read-user", limit: 600, windowSeconds: 10 * 60 },
  exportDownloadUser: { namespace: "export-download-user", limit: 30, windowSeconds: 10 * 60 },
  feedbackWriteUser: { namespace: "feedback-write-user", limit: 30, windowSeconds: 60 * 60 },
  attendanceScanUser: { namespace: "attendance-scan-user", limit: 300, windowSeconds: 10 * 60 },
  attendanceWriteUser: { namespace: "attendance-write-user", limit: 240, windowSeconds: 10 * 60 },
  eventWriteUser: { namespace: "event-write-user", limit: 120, windowSeconds: 60 * 60 },
  registrationWriteUser: {
    namespace: "registration-write-user",
    limit: 120,
    windowSeconds: 60 * 60,
  },
  adminWriteUser: { namespace: "admin-write-user", limit: 120, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitPolicy>;

type RateLimitRow = {
  count: number;
  expiresAt: Date;
};

function deniedResult(policy: RateLimitPolicy): RateLimitResult {
  return {
    allowed: false,
    limit: policy.limit,
    remaining: 0,
    retryAfterSeconds: policy.windowSeconds,
    resetAt: new Date(Date.now() + policy.windowSeconds * 1_000),
  };
}

/**
 * Atomically increments a fixed-window counter in PostgreSQL.
 *
 * A single INSERT ... ON CONFLICT statement makes concurrent attempts safe;
 * an in-memory limiter would be bypassable across processes and deployments.
 *
 * Database failures are treated as a denial. A limiter that fails open would
 * turn a database outage into an authentication brute-force window, so the
 * failure mode is explicit rather than delegated to each caller.
 */
export async function consumeRateLimit(
  policy: RateLimitPolicy,
  value: string,
): Promise<RateLimitResult> {
  const key = rateLimitKey(policy.namespace, value.trim().toLowerCase() || "unknown");

  let rows: RateLimitRow[];

  try {
    rows = await prisma.$queryRaw<RateLimitRow[]>`
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
  } catch (error) {
    // Log only the error class. Query text and connection details can contain
    // infrastructure information and must not reach application logs.
    console.error(`Rate limiter unavailable: ${error instanceof Error ? error.name : "unknown"}`);
    return deniedResult(policy);
  }

  const row = rows[0];

  if (!row) {
    return deniedResult(policy);
  }

  const count = Number(row.count);
  const allowed = count <= policy.limit;
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((row.expiresAt.getTime() - Date.now()) / 1_000));

  maybePruneExpiredRateLimits();

  return {
    allowed,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    retryAfterSeconds,
    resetAt: row.expiresAt,
  };
}

/**
 * Enforces a policy for an authenticated operation and raises the shared 429
 * domain error when the caller is over budget. Callers at the action/route
 * boundary use this so service-level tests remain deterministic.
 */
export async function enforceRateLimit(
  policy: RateLimitPolicy,
  value: string,
): Promise<RateLimitResult> {
  const result = await consumeRateLimit(policy, value);

  if (!result.allowed) {
    throw new RateLimitedError(
      result.retryAfterSeconds,
      "Too many requests. Please wait a moment and try again.",
    );
  }

  return result;
}

/**
 * Opportunistic cleanup keeps the table bounded even when the operator has not
 * scheduled `npm run db:prune-rate-limits`. It never blocks the request and a
 * cleanup failure must not fail the operation being limited.
 */
function maybePruneExpiredRateLimits(): void {
  if (process.env.NODE_ENV === "test" || Math.random() >= 0.01) {
    return;
  }

  void pruneExpiredRateLimits().catch(() => undefined);
}

export async function pruneExpiredRateLimits(olderThanMs = 24 * 60 * 60 * 1_000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.rateLimitEntry.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  return result.count;
}

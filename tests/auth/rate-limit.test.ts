import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { RATE_LIMITS, consumeRateLimit, pruneExpiredRateLimits } from "@/server/auth/rate-limit";
import { rateLimitKey } from "@/server/auth/request-context";
import { resetDatabase } from "@tests/helpers/db";

beforeEach(async () => {
  await resetDatabase();
});

describe("PostgreSQL rate limiting", () => {
  it("allows up to the policy limit and then fails closed", async () => {
    const policy = { namespace: "test-login", limit: 2, windowSeconds: 60 };
    const value = "rate-limit@example.test";

    const first = await consumeRateLimit(policy, value);
    const second = await consumeRateLimit(policy, value);
    const third = await consumeRateLimit(policy, value);

    expect(first).toMatchObject({ allowed: true, remaining: 1 });
    expect(second).toMatchObject({ allowed: true, remaining: 0 });
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
    expect(third.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("is atomic under concurrent attempts", async () => {
    const policy = { namespace: "test-concurrent", limit: 5, windowSeconds: 60 };
    const value = "concurrent@example.test";

    const results = await Promise.all(
      Array.from({ length: 12 }, () => consumeRateLimit(policy, value)),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(7);

    const row = await prisma.rateLimitEntry.findFirstOrThrow({
      where: { key: rateLimitKey(policy.namespace, value) },
    });
    expect(row.count).toBe(12);
  });

  it("stores an HMAC lookup key rather than the raw email or IP", async () => {
    const policy = RATE_LIMITS.loginEmail;
    const email = "Private.Person@Example.TEST";

    await consumeRateLimit(policy, email);

    const row = await prisma.rateLimitEntry.findFirstOrThrow();
    expect(row.key).toHaveLength(64);
    expect(row.key).toBe(rateLimitKey(policy.namespace, email.toLowerCase()));
    expect(row.key).not.toContain(email.toLowerCase());
    expect(JSON.stringify(row)).not.toContain("private.person");
  });

  it("keeps separate namespaces isolated", async () => {
    const value = "namespace@example.test";
    const emailPolicy = { namespace: "test-email", limit: 1, windowSeconds: 60 };
    const ipPolicy = { namespace: "test-ip", limit: 1, windowSeconds: 60 };

    expect((await consumeRateLimit(emailPolicy, value)).allowed).toBe(true);
    expect((await consumeRateLimit(emailPolicy, value)).allowed).toBe(false);
    expect((await consumeRateLimit(ipPolicy, value)).allowed).toBe(true);
  });

  it("starts a new fixed window after expiry", async () => {
    const policy = { namespace: "test-window", limit: 1, windowSeconds: 60 };
    const value = "window@example.test";

    await consumeRateLimit(policy, value);
    await consumeRateLimit(policy, value);

    await prisma.rateLimitEntry.updateMany({
      where: { key: rateLimitKey(policy.namespace, value) },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const reset = await consumeRateLimit(policy, value);
    expect(reset).toMatchObject({ allowed: true, remaining: 0 });

    const row = await prisma.rateLimitEntry.findFirstOrThrow({
      where: { key: rateLimitKey(policy.namespace, value) },
    });
    expect(row.count).toBe(1);
  });

  it("prunes only expired rows", async () => {
    await prisma.rateLimitEntry.createMany({
      data: [
        {
          key: "expired-old",
          count: 1,
          windowStartedAt: new Date(Date.now() - 2 * 86_400_000),
          expiresAt: new Date(Date.now() - 2 * 86_400_000),
        },
        {
          key: "expired-recent",
          count: 1,
          windowStartedAt: new Date(Date.now() - 60_000),
          expiresAt: new Date(Date.now() - 60_000),
        },
        {
          key: "active",
          count: 1,
          windowStartedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    });

    const deleted = await pruneExpiredRateLimits(86_400_000);
    expect(deleted).toBe(1);
    expect(await prisma.rateLimitEntry.count()).toBe(2);
  });
});

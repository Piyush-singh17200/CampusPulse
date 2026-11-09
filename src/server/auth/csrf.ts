import "server-only";

import { headers } from "next/headers";

import { env } from "@/config/env";
import { OriginValidationError } from "@/server/errors";

export function isTrustedOrigin(origin: string | null, allowedOrigins: readonly string[]): boolean {
  if (!origin) {
    return false;
  }

  let parsedOrigin: string;

  try {
    parsedOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  return allowedOrigins.some((allowed) => {
    try {
      return new URL(allowed).origin === parsedOrigin;
    } catch {
      return false;
    }
  });
}

/**
 * Server Actions have built-in origin protection. This explicit check is a
 * second layer for authentication mutations and also rejects cross-site
 * browser metadata when present.
 */
export function isTrustedFetchSite(value: string | null): boolean {
  return !value || value === "same-origin" || value === "none";
}

export async function assertSameOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const allowedOrigins = [
    new URL(env.NEXT_PUBLIC_APP_URL).origin,
    new URL(env.BETTER_AUTH_URL).origin,
  ];

  if (!isTrustedOrigin(requestHeaders.get("origin"), allowedOrigins)) {
    throw new OriginValidationError();
  }

  if (!isTrustedFetchSite(requestHeaders.get("sec-fetch-site"))) {
    throw new OriginValidationError();
  }
}

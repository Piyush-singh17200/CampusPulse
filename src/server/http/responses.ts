import { DomainError, RateLimitedError } from "@/server/errors";

export const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
} as const;

export function emptyResponse(status: number, headers: HeadersInit = {}): Response {
  return new Response(null, {
    status,
    headers: { ...PRIVATE_NO_STORE_HEADERS, ...headers },
  });
}

/**
 * Convert a domain failure into a safe HTTP response. Unexpected failures are
 * logged without response details so database and storage internals never leak.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    const headers =
      error instanceof RateLimitedError
        ? { "Retry-After": String(error.retryAfterSeconds) }
        : undefined;

    return emptyResponse(error.status, headers);
  }

  console.error(`Download route failed: ${error instanceof Error ? error.name : "unknown"}`);
  return emptyResponse(500);
}

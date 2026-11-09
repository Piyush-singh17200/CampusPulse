import "server-only";

import { createHmac } from "node:crypto";

import { headers } from "next/headers";

import { env } from "@/config/env";

import { normalizeEmail } from "./validation";

function getRateLimitSecret(): string {
  return env.RATE_LIMIT_SECRET ?? env.BETTER_AUTH_SECRET;
}

export function hashIdentifier(scope: string, value: string): string {
  return createHmac("sha256", getRateLimitSecret()).update(`${scope}:${value}`).digest("hex");
}

export function hashEmail(email: string): string {
  return hashIdentifier("email", normalizeEmail(email));
}

export function hashIp(ip: string): string {
  return hashIdentifier("ip", ip.trim().toLowerCase());
}

/**
 * Rate-limit lookup keys are HMAC digests. Raw emails and IP addresses never
 * appear in the rate-limit table or in application logs.
 */
export function rateLimitKey(namespace: string, value: string): string {
  return hashIdentifier(`rate-limit:${namespace}`, value);
}

export function getClientIp(requestHeaders: Headers): string {
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first && first.length <= 64) {
      return first;
    }
  }

  for (const headerName of ["x-real-ip", "cf-connecting-ip"]) {
    const value = requestHeaders.get(headerName)?.trim();
    if (value && value.length <= 64) {
      return value;
    }
  }

  return "unknown";
}

export function sanitizeUserAgent(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return sanitized ? sanitized.slice(0, 512) : undefined;
}

export type RequestIdentity = {
  ip: string;
  userAgent?: string;
};

export async function getRequestIdentity(): Promise<RequestIdentity> {
  const requestHeaders = await headers();

  return {
    ip: getClientIp(requestHeaders),
    userAgent: sanitizeUserAgent(requestHeaders.get("user-agent")),
  };
}

export type RequestAuditContext = {
  ipHash: string;
  userAgent?: string;
};

export async function getRequestAuditContext(): Promise<RequestAuditContext> {
  const identity = await getRequestIdentity();

  return {
    ipHash: hashIp(identity.ip),
    userAgent: identity.userAgent,
  };
}

import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { env } from "@/config/env";
import { prisma } from "@/server/db/client";

import { hashPassword, verifyPassword } from "./password";

const appOrigin = new URL(env.NEXT_PUBLIC_APP_URL).origin;
const authOrigin = new URL(env.BETTER_AUTH_URL).origin;
const usesHttps = new URL(env.BETTER_AUTH_URL).protocol === "https:";
// Production cookies must always carry Secure, even if a deployment has not
// yet corrected an HTTP base URL. Local/test HTTP remains usable outside
// production. Production deployments must still use HTTPS end-to-end.
const secureCookies = usesHttps || process.env.NODE_ENV === "production";

export const auth = betterAuth({
  appName: "CampusPulse",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: Array.from(new Set([appOrigin, authOrigin])),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    // Registration is implemented by our validated server action so the role,
    // college, and student profile can never be supplied by the browser.
    disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: false,
    },
  },
  advanced: {
    database: {
      // The auth tables use PostgreSQL UUID primary keys.
      generateId: "uuid",
    },
    useSecureCookies: secureCookies,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: "/",
    },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"],
    },
    disableCSRFCheck: false,
  },
  // The application uses a PostgreSQL-backed limiter for the auth server
  // actions. Better Auth's optional in-memory limiter is intentionally off.
  rateLimit: {
    enabled: false,
  },
  // nextCookies must be the last plugin so Server Action cookie mutations are
  // applied to the outgoing response.
  plugins: [nextCookies()],
});

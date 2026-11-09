import { config as loadEnv } from "dotenv";

import { assertTestDatabaseUrl } from "@/server/db/config";

loadEnv({ path: ".env.local" });

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required. Add the isolated campuspulse_test URL to .env.local.",
  );
}

assertTestDatabaseUrl(testUrl);

// The application client reads DATABASE_URL. Tests must never inherit the
// development URL from .env.local.
Object.assign(process.env, {
  DATABASE_URL: testUrl,
  DIRECT_URL: testUrl,
  NODE_ENV: "test",
  BETTER_AUTH_SECRET: "test-only-better-auth-secret-0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  EMAIL_ENABLED: "false",
});

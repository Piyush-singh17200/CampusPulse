import { afterEach, describe, expect, it, vi } from "vitest";

import { serverEnvSchema } from "@/config/env";

const baseEnv = {
  DATABASE_URL: "postgresql://campuspulse:campuspulse@localhost:5434/campuspulse",
  DIRECT_URL: "postgresql://campuspulse:campuspulse@localhost:5434/campuspulse",
  NEXT_PUBLIC_APP_URL: "https://campuspulse.example",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "https://campuspulse.example",
  EMAIL_ENABLED: "false",
  SMTP_SECURE: "false",
  POSTER_STORAGE_DRIVER: "s3",
  S3_ENDPOINT: "https://s3.example.com",
  S3_REGION: "us-east-1",
  S3_BUCKET: "campuspulse-posters",
  S3_ACCESS_KEY_ID: "access-key",
  S3_SECRET_ACCESS_KEY: "secret-key",
} as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("S3 endpoint security validation", () => {
  it("rejects any HTTP endpoint in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    const result = serverEnvSchema.safeParse({
      ...baseEnv,
      S3_ENDPOINT: "http://s3.example.com",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => /https in production/i.test(issue.message))).toBe(
        true,
      );
    }
  });

  it("allows localhost HTTP only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(
      serverEnvSchema.safeParse({
        ...baseEnv,
        S3_ENDPOINT: "http://localhost:9000",
      }).success,
    ).toBe(true);
  });

  it("requires an explicit opt-in for non-local HTTP in development", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(
      serverEnvSchema.safeParse({
        ...baseEnv,
        S3_ENDPOINT: "http://192.0.2.10:9000",
      }).success,
    ).toBe(false);

    expect(
      serverEnvSchema.safeParse({
        ...baseEnv,
        S3_ENDPOINT: "http://192.0.2.10:9000",
        S3_ALLOW_INSECURE: "true",
      }).success,
    ).toBe(true);
  });

  it("rejects non-HTTP endpoint protocols and accepts HTTPS", () => {
    expect(
      serverEnvSchema.safeParse({
        ...baseEnv,
        S3_ENDPOINT: "ftp://s3.example.com",
      }).success,
    ).toBe(false);

    expect(serverEnvSchema.safeParse(baseEnv).success).toBe(true);
  });
});

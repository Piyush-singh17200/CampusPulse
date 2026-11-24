import "server-only";

import { z } from "zod";

const booleanStringSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const defaultTrueBooleanStringSchema = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

export const serverEnvSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required.")
      .refine(
        (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "DATABASE_URL must be a PostgreSQL connection string.",
      ),
    DIRECT_URL: z
      .string()
      .min(1, "DIRECT_URL is required.")
      .refine(
        (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "DIRECT_URL must be a PostgreSQL connection string.",
      ),
    NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid absolute URL."),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must contain at least 32 characters.")
      .max(512, "BETTER_AUTH_SECRET is too long."),
    BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid absolute URL."),
    RATE_LIMIT_SECRET: z.string().min(32).max(512).optional(),
    EMAIL_ENABLED: booleanStringSchema,
    SMTP_HOST: z.string().min(1).max(255).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_SECURE: booleanStringSchema,
    SMTP_USER: z.string().max(320).optional(),
    SMTP_PASSWORD: z.string().max(1_000).optional(),
    EMAIL_FROM: z.string().min(1).max(320).default("CampusPulse <no-reply@campuspulse.local>"),
    POSTER_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    POSTER_STORAGE_DIR: z.string().min(1).max(1_024).optional(),
    S3_ENDPOINT: z.string().url("S3_ENDPOINT must be a valid absolute URL.").optional(),
    S3_REGION: z.string().min(1).max(64).optional(),
    S3_BUCKET: z.string().min(3).max(255).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).max(255).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).max(512).optional(),
    S3_SESSION_TOKEN: z.string().min(1).max(8_192).optional(),
    S3_ALLOW_INSECURE: booleanStringSchema,
    S3_FORCE_PATH_STYLE: defaultTrueBooleanStringSchema,
    S3_PREFIX: z.string().max(200).optional(),
    TRUST_PROXY_HEADERS: booleanStringSchema,
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  })
  .superRefine((value, context) => {
    if (process.env.NODE_ENV === "production") {
      const localHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);

      for (const [field, rawUrl] of [
        ["NEXT_PUBLIC_APP_URL", value.NEXT_PUBLIC_APP_URL],
        ["BETTER_AUTH_URL", value.BETTER_AUTH_URL],
      ] as const) {
        const url = new URL(rawUrl);

        if (url.protocol !== "https:" && !localHostnames.has(url.hostname)) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `${field} must use https in production. Localhost URLs are allowed for local production builds only.`,
          });
        }
      }
    }

    if (value.EMAIL_ENABLED && !value.SMTP_HOST) {
      context.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "SMTP_HOST is required when EMAIL_ENABLED=true.",
      });
    }

    if (value.EMAIL_ENABLED && !value.EMAIL_FROM) {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_FROM"],
        message: "EMAIL_FROM is required when EMAIL_ENABLED=true.",
      });
    }

    if (value.S3_ENDPOINT) {
      let endpoint: URL;

      try {
        endpoint = new URL(value.S3_ENDPOINT);
      } catch {
        endpoint = new URL("https://invalid.example");
      }

      if (!["http:", "https:"].includes(endpoint.protocol)) {
        context.addIssue({
          code: "custom",
          path: ["S3_ENDPOINT"],
          message: "S3_ENDPOINT must use http or https.",
        });
      } else if (endpoint.protocol === "http:") {
        const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);

        if (process.env.NODE_ENV === "production") {
          context.addIssue({
            code: "custom",
            path: ["S3_ENDPOINT"],
            message: "S3_ENDPOINT must use https in production.",
          });
        } else if (!isLocalhost && !value.S3_ALLOW_INSECURE) {
          context.addIssue({
            code: "custom",
            path: ["S3_ENDPOINT"],
            message:
              "S3_ENDPOINT must use https, or set S3_ALLOW_INSECURE=true for a non-local development endpoint.",
          });
        }
      }
    }

    if (value.EMAIL_ENABLED && value.SMTP_USER && !value.SMTP_PASSWORD) {
      context.addIssue({
        code: "custom",
        path: ["SMTP_PASSWORD"],
        message: "SMTP_PASSWORD is required when SMTP_USER is set.",
      });
    }

    if (value.EMAIL_ENABLED && !value.SMTP_USER && value.SMTP_PASSWORD) {
      context.addIssue({
        code: "custom",
        path: ["SMTP_USER"],
        message: "SMTP_USER is required when SMTP_PASSWORD is set.",
      });
    }

    if (value.POSTER_STORAGE_DRIVER === "s3") {
      const required = [
        ["S3_ENDPOINT", value.S3_ENDPOINT],
        ["S3_REGION", value.S3_REGION],
        ["S3_BUCKET", value.S3_BUCKET],
        ["S3_ACCESS_KEY_ID", value.S3_ACCESS_KEY_ID],
        ["S3_SECRET_ACCESS_KEY", value.S3_SECRET_ACCESS_KEY],
      ] as const;

      for (const [field, fieldValue] of required) {
        if (!fieldValue) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `${field} is required when POSTER_STORAGE_DRIVER=s3.`,
          });
        }
      }
    }
  });

const parsed = serverEnvSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  RATE_LIMIT_SECRET: process.env.RATE_LIMIT_SECRET,
  EMAIL_ENABLED: process.env.EMAIL_ENABLED,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM,
  POSTER_STORAGE_DRIVER: process.env.POSTER_STORAGE_DRIVER,
  POSTER_STORAGE_DIR: process.env.POSTER_STORAGE_DIR,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_SESSION_TOKEN: process.env.S3_SESSION_TOKEN,
  S3_ALLOW_INSECURE: process.env.S3_ALLOW_INSECURE,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
  S3_PREFIX: process.env.S3_PREFIX,
  TRUST_PROXY_HEADERS: process.env.TRUST_PROXY_HEADERS,
  TRUSTED_PROXY_HOPS: process.env.TRUSTED_PROXY_HOPS,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join(" ");

  // Field names are safe to log; values may contain credentials and must never
  // be included in startup errors or application logs.
  throw new Error(`Invalid environment configuration. ${details}`);
}

export const env = Object.freeze(parsed.data);

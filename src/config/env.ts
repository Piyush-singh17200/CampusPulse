import "server-only";

import { z } from "zod";

const booleanStringSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const serverEnvSchema = z
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
  })
  .superRefine((value, context) => {
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

import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid absolute URL."),
});

const fallbackUrl = process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined;

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? fallbackUrl,
});

if (!parsed.success) {
  throw new Error("NEXT_PUBLIC_APP_URL is required in production and must be an absolute URL.");
}

export const publicEnv = Object.freeze(parsed.data);

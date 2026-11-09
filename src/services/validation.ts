import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { InvalidInputError } from "@/server/errors";

export const uuidSchema = z.string().uuid("A valid UUID is required.");

export const eventStatusSchema = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "PUBLISHED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
]);

export const userRoleSchema = z.enum(["STUDENT", "CLUB_ADMIN", "COLLEGE_ADMIN", "SUPER_ADMIN"]);

export function parseServiceInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join("; ");
    throw new InvalidInputError(message);
  }

  return parsed.data;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function assertDateOrder(input: {
  startsAt: Date;
  endsAt: Date;
  registrationOpensAt?: Date | null;
  registrationDeadline?: Date | null;
}): void {
  if (input.endsAt <= input.startsAt) {
    throw new InvalidInputError("Event end time must be after the start time.");
  }

  if (
    input.registrationOpensAt &&
    input.registrationDeadline &&
    input.registrationOpensAt >= input.registrationDeadline
  ) {
    throw new InvalidInputError("Registration must open before it closes.");
  }

  if (input.registrationDeadline && input.registrationDeadline > input.startsAt) {
    throw new InvalidInputError("Registration must close on or before the event start time.");
  }

  if (input.registrationOpensAt && input.registrationOpensAt >= input.startsAt) {
    throw new InvalidInputError("Registration must open before the event start time.");
  }
}

export type TransactionClient = Prisma.TransactionClient;

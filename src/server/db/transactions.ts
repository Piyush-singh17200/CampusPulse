import { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/server/db/factory";

export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isPrismaForeignKeyError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

export function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

/**
 * Prisma transaction options are intentionally explicit. The event and
 * registration services use row-level locks inside these transactions; retries
 * cover PostgreSQL serialization/deadlock failures without retrying domain
 * validation errors.
 */
export const TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: 10_000,
} as const;

export async function runInTransaction<T>(
  prisma: DatabaseClient,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, TRANSACTION_OPTIONS);
    } catch (error) {
      lastError = error;

      if (!isRetryableTransactionError(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw lastError;
}

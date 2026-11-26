import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import type { DatabaseConfig } from "@/server/db/config";

/**
 * Pure client factory. Keeping this separate from the `server-only` singleton
 * lets the seed script and database tests create short-lived clients without
 * importing React/Next server-only guards.
 */
export function createDatabaseClient(config: DatabaseConfig) {
  const adapter = new PrismaPg({
    connectionString: config.url,
    max: config.poolMax,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
    application_name: config.applicationName,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ...(config.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
  });

  return new PrismaClient({
    adapter,
    log: config.logQueries ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

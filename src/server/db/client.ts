import "server-only";

import { getDatabaseConfig } from "@/server/db/config";
import { createDatabaseClient, type DatabaseClient } from "@/server/db/factory";

export { createDatabaseClient, type DatabaseClient } from "@/server/db/factory";

const globalForPrisma = globalThis as unknown as {
  campuspulsePrisma?: DatabaseClient;
};

/**
 * Reuse one Prisma client across hot reloads in development. Creating a new
 * client on every reload would leak PostgreSQL connections. The key is namespaced
 * to avoid colliding with other tools that also use a global `prisma` property.
 */
export const prisma =
  globalForPrisma.campuspulsePrisma ?? createDatabaseClient(getDatabaseConfig());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.campuspulsePrisma = prisma;
}

export async function checkDatabaseConnection(): Promise<{ ok: true; latencyMs: number }> {
  const startedAt = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return { ok: true, latencyMs: Date.now() - startedAt };
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

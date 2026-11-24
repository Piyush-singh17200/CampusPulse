import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { getDatabaseConfig } from "../src/server/db/config";
import { createDatabaseClient } from "../src/server/db/factory";

/**
 * Deletes expired rate-limit counters. The limiter also prunes opportunistically
 * (about 1% of successful calls), but a scheduled run keeps the table bounded
 * on quiet deployments and gives operators a deterministic cleanup command.
 *
 * This script intentionally uses the pure database factory instead of the
 * server-only application singleton so it can be run from a normal Node process.
 */
async function main(): Promise<void> {
  const prisma = createDatabaseClient(
    getDatabaseConfig({ applicationName: "campuspulse-rate-limit-prune" }),
  );

  try {
    const deleted = await prisma.rateLimitEntry.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    console.log(`Deleted ${deleted.count} expired rate-limit row(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`Rate-limit pruning failed: ${error instanceof Error ? error.name : "unknown"}`);
  process.exitCode = 1;
});

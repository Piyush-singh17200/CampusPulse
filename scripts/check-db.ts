import { config as loadEnv } from "dotenv";

import { getDatabaseConfig } from "../src/server/db/config";
import { createDatabaseClient } from "../src/server/db/factory";

loadEnv({ path: ".env.local" });

const client = createDatabaseClient(getDatabaseConfig({ applicationName: "campuspulse-health" }));

const startedAt = Date.now();

try {
  const rows = await client.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database() AS current_database
  `;
  const latencyMs = Date.now() - startedAt;
  console.log(
    `Database connection OK: ${rows[0]?.current_database ?? "unknown"} (${latencyMs} ms)`,
  );
} catch (error) {
  console.error(
    `Database connection failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
} finally {
  await client.$disconnect();
}

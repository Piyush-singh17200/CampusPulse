import { spawnSync } from "node:child_process";
import path from "node:path";

import { config as loadEnv } from "dotenv";
import { Client } from "pg";

import { assertTestDatabaseUrl, getDatabaseName, TEST_DATABASE_NAME } from "@/server/db/config";

loadEnv({ path: ".env.local" });

function getTestUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required. Add the isolated campuspulse_test URL to .env.local.",
    );
  }

  assertTestDatabaseUrl(testUrl);
  return testUrl;
}

function getAdminUrl(testUrl: string): string {
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";
  return adminUrl.toString();
}

async function ensureTestDatabase(testUrl: string): Promise<void> {
  const admin = new Client({ connectionString: getAdminUrl(testUrl) });
  await admin.connect();

  try {
    const databaseName = getDatabaseName(testUrl);
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      databaseName,
    ]);

    if (exists.rowCount === 0) {
      // The identifier is a fixed, validated constant, not user input.
      await admin.query(`CREATE DATABASE "${TEST_DATABASE_NAME}"`);
    }
  } finally {
    await admin.end();
  }
}

function migrateTestDatabase(testUrl: string): void {
  const prismaCli = path.resolve("node_modules/prisma/build/index.js");
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: testUrl,
      DIRECT_URL: testUrl,
    },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("The isolated test database migrations failed.");
  }
}

export default async function globalSetup(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to prepare the test database while NODE_ENV=production.");
  }

  const testUrl = getTestUrl();
  await ensureTestDatabase(testUrl);
  migrateTestDatabase(testUrl);
}

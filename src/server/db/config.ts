import { z } from "zod";

const databaseUrlSchema = z
  .string()
  .min(1, "DATABASE_URL is required.")
  .refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL must be a PostgreSQL connection string.",
  );

const booleanStringSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const databaseConfigSchema = z.object({
  url: databaseUrlSchema,
  poolMax: z.coerce.number().int().min(1).max(50).default(10),
  connectionTimeoutMs: z.coerce.number().int().min(250).max(60_000).default(20_000),
  idleTimeoutMs: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
  ssl: booleanStringSchema,
  logQueries: booleanStringSchema,
  applicationName: z.string().min(1).max(64).default("campuspulse"),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

type DatabaseConfigOverrides = Partial<
  Pick<DatabaseConfig, "url" | "poolMax" | "connectionTimeoutMs" | "ssl">
> & {
  applicationName?: string;
};

/**
 * Central database configuration. Keeping pool settings and test guards here
 * prevents the app, seed, and tests from drifting into different connection
 * behavior.
 */
export function getDatabaseConfig(overrides: DatabaseConfigOverrides = {}): DatabaseConfig {
  const url = overrides.url ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is required before the database client can be created.");
  }

  const parsed = databaseConfigSchema.safeParse({
    url,
    poolMax: process.env.DATABASE_POOL_MAX,
    connectionTimeoutMs: process.env.DATABASE_CONNECTION_TIMEOUT_MS,
    idleTimeoutMs: process.env.DATABASE_IDLE_TIMEOUT_MS,
    ssl: process.env.DATABASE_SSL,
    logQueries: process.env.DATABASE_LOG_QUERIES,
    applicationName: overrides.applicationName ?? process.env.DATABASE_APP_NAME,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "database"}: ${issue.message}`)
      .join(" ");

    // Never include the URL or credentials in the error.
    throw new Error(`Invalid database configuration. ${details}`);
  }

  const config = {
    ...parsed.data,
    url,
    poolMax: overrides.poolMax ?? parsed.data.poolMax,
    connectionTimeoutMs: overrides.connectionTimeoutMs ?? parsed.data.connectionTimeoutMs,
    ssl: overrides.ssl ?? parsed.data.ssl,
  };

  if (process.env.NODE_ENV === "test") {
    assertTestDatabaseUrl(config.url);
  }

  return config;
}

export const TEST_DATABASE_NAME = "campuspulse_test";

const LOCAL_TEST_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function getDatabaseName(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\//, "").split("?")[0] || null;
  } catch {
    return null;
  }
}

export function isTestDatabaseUrl(url: string): boolean {
  return getDatabaseName(url) === TEST_DATABASE_NAME;
}

/**
 * Fail closed before any destructive test operation. The test database must be
 * named exactly campuspulse_test and must resolve to a local host.
 */
export function assertTestDatabaseUrl(url: string): void {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid PostgreSQL URL.");
  }

  const databaseName = getDatabaseName(url);
  const host = parsed.hostname.toLowerCase();

  if (databaseName !== TEST_DATABASE_NAME) {
    throw new Error(
      `Refusing to use a non-test database. Expected database "${TEST_DATABASE_NAME}", received "${databaseName ?? "unknown"}".`,
    );
  }

  if (!LOCAL_TEST_HOSTS.has(host)) {
    throw new Error(
      `Refusing to use a remote test database host "${host}". Tests may only target localhost.`,
    );
  }
}

export function assertNotTestDatabaseUrl(url: string): void {
  if (isTestDatabaseUrl(url)) {
    throw new Error("Refusing to run a development operation against the test database.");
  }
}

/**
 * Seed data is fictional development data. Refuse production and remote
 * databases so a mistyped environment variable cannot populate a real system.
 */
export function assertDevelopmentDatabaseUrl(url: string): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the development seed while NODE_ENV=production.");
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }

  if (isTestDatabaseUrl(url)) {
    throw new Error("Refusing to run the development seed against the test database.");
  }

  if (!LOCAL_TEST_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      `Refusing to seed a remote database host "${parsed.hostname}". The development seed is local-only.`,
    );
  }
}

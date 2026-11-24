import { checkDatabaseConnection } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEALTH_PROBE_TIMEOUT_MS = 2_000;

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Health probe timed out.")), timeoutMs);
  });

  try {
    return await Promise.race([promise, deadline]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Public liveness/readiness probe. It deliberately exposes only a boolean
 * database status, latency, process uptime, and a timestamp. It never returns
 * connection strings, versions with known vulnerabilities, or error messages.
 */
export async function GET() {
  const checkedAt = new Date().toISOString();
  const uptimeSeconds = Math.floor(process.uptime());

  try {
    const database = await withTimeout(checkDatabaseConnection(), HEALTH_PROBE_TIMEOUT_MS);

    return Response.json(
      {
        status: "ok",
        checkedAt,
        uptimeSeconds,
        checks: {
          database: { status: "ok", latencyMs: database.latencyMs },
        },
      },
      { status: 200, headers: noStoreHeaders() },
    );
  } catch {
    return Response.json(
      {
        status: "error",
        checkedAt,
        uptimeSeconds,
        checks: {
          database: { status: "error" },
        },
      },
      { status: 503, headers: noStoreHeaders() },
    );
  }
}

import { describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { createDatabaseClient } from "@/server/db/client";
import { getDatabaseConfig } from "@/server/db/config";
import { createTenantContext } from "@/server/db/tenant";
import { InvalidInputError } from "@/server/errors";

describe("database client", () => {
  it("connects to the isolated test database", async () => {
    const rows = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database() AS current_database
    `;

    expect(rows[0]?.current_database).toBe("campuspulse_test");
  });

  it("reuses the development-safe singleton", async () => {
    const secondImport = await import("@/server/db/client");
    expect(secondImport.prisma).toBe(prisma);
  });

  it("refuses a non-test database when NODE_ENV=test", () => {
    expect(() =>
      getDatabaseConfig({
        url: "postgresql://campuspulse:campuspulse@localhost:5434/campuspulse?schema=public",
      }),
    ).toThrow(/non-test database/i);
  });

  it("handles an unreachable database without leaking credentials", async () => {
    const config = getDatabaseConfig({
      url: "postgresql://campuspulse:campuspulse@127.0.0.1:1/campuspulse_test?schema=public",
      connectionTimeoutMs: 500,
      applicationName: "campuspulse-test-failure",
    });
    const client = createDatabaseClient(config);

    try {
      await expect(client.$queryRaw`SELECT 1`).rejects.toBeTruthy();
    } finally {
      await client.$disconnect();
    }
  });
});

describe("tenant context", () => {
  it("accepts a valid college context", () => {
    const context = createTenantContext({
      collegeId: "11111111-1111-4111-8111-111111111111",
    });
    expect(context.collegeId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("fails closed when tenant context is missing", () => {
    expect(() => createTenantContext({})).toThrow(InvalidInputError);
  });

  it("fails closed when tenant context is invalid", () => {
    expect(() => createTenantContext({ collegeId: "not-a-uuid" })).toThrow(InvalidInputError);
  });
});

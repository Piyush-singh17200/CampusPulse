import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";

const PASSWORD = "CampusPulse!2026";
const CLUB_ADMIN_EMAIL = "robotics.president@campuspulse.example";
const STUDENT_EMAIL = "isha.rao@campuspulse.example";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const SCREENSHOT_DIR = path.join(process.cwd(), "docs", "screenshots", "prompt-9");

function databaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const envFile = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const match = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(envFile);
  if (!match?.[1]) {
    throw new Error("DATABASE_URL is missing from .env.local.");
  }
  return match[1];
}

async function withDatabase<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function clearDevelopmentRateLimits(): Promise<void> {
  // Browser verification uses the development database and creates fresh
  // sessions. Clear stale limiter windows so repeat local runs remain
  // deterministic without changing the application policy.
  await withDatabase(async (client) => {
    await client.query('delete from "rate_limit_entries"');
  });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/account");
  await expect(page.getByRole("heading", { name: /hello/i })).toBeVisible();
}

async function newLoggedInPage(browser: Browser, email: string) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await login(page, email);
  return { context, page };
}

async function hideDevOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
  });
}

async function screenshot(page: Page, name: string): Promise<void> {
  await hideDevOverlay(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, name),
    fullPage: true,
    caret: "initial",
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(1);
}

async function attendanceExportTarget(): Promise<{ clubId: string; eventId: string }> {
  return withDatabase(async (client) => {
    const result = await client.query<{ clubId: string; eventId: string }>(
      `select c.id as "clubId", e.id as "eventId"
       from users u
       join club_memberships m
         on m."userId" = u.id
        and m.status = 'ACTIVE'
        and m.role in ('PRESIDENT', 'OFFICER')
       join clubs c on c.id = m."clubId"
       join events e on e."clubId" = c.id
       join event_registrations r on r."eventId" = e.id
       where u.email = $1 and e.status in ('PUBLISHED', 'COMPLETED')
       group by c.id, e.id
       having count(r.id) > 0
       order by count(r.id) desc
       limit 1`,
      [CLUB_ADMIN_EMAIL],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("No completed event with registrations was found for the club admin.");
    }

    return row;
  });
}

test("Prompt 9 health endpoint reports readiness without leaking configuration", async ({
  request,
}) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");

  const body = await response.json();
  expect(body).toMatchObject({
    status: "ok",
    checks: { database: { status: "ok" } },
  });
  expect(typeof body.checks.database.latencyMs).toBe("number");
  expect(typeof body.uptimeSeconds).toBe("number");
  expect(JSON.stringify(body)).not.toContain("postgresql://");
  expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
});

test("Prompt 9 pages carry the hardened security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();

  expect(response.status()).toBe(200);
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toMatch(/nonce-[A-Za-z0-9+/=]+/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("Prompt 9 unauthenticated exports, calendars, and posters return 401", async ({ request }) => {
  const missingEventId = "00000000-0000-4000-8000-000000000000";
  const paths = [
    "/api/exports/club/analytics",
    `/api/exports/club/attendance?clubId=${missingEventId}&eventId=${missingEventId}`,
    "/api/exports/college/analytics",
    "/api/exports/platform/analytics",
    "/api/calendar/registered",
    "/api/calendar/saved",
    `/api/calendar/events/${missingEventId}`,
    `/api/posters/${missingEventId}`,
  ];

  for (const requestPath of paths) {
    const response = await request.get(requestPath);
    expect(response.status(), requestPath).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});

test("Prompt 9 club attendance export is rate-limited and audited end to end", async ({
  browser,
}) => {
  const { clubId, eventId } = await attendanceExportTarget();
  const entityId = `club-attendance:${eventId}`;

  await withDatabase(async (client) => {
    await client.query('delete from "audit_logs" where action = $1 and "entityId" = $2', [
      "EXPORT_DOWNLOADED",
      entityId,
    ]);
  });

  const { context, page } = await newLoggedInPage(browser, CLUB_ADMIN_EMAIL);

  try {
    // Remove the login window so the assertion below is attributable to the
    // export route rather than the sign-in action.
    await clearDevelopmentRateLimits();

    const response = await page.request.get(
      `/api/exports/club/attendance?clubId=${clubId}&eventId=${eventId}`,
    );

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["content-disposition"]).toContain("attachment");

    const body = await response.body();
    expect(Array.from(body.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

    const text = body.toString("utf8");
    expect(text).toContain("Student,Roll number,Department,Status");

    const audit = await withDatabase(async (client) => {
      const result = await client.query<{
        actorEmail: string;
        entityType: string;
        entityId: string;
        metadata: Record<string, unknown>;
      }>(
        `select u.email as "actorEmail",
                a."entityType" as "entityType",
                a."entityId" as "entityId",
                a.metadata as "metadata"
         from audit_logs a
         join users u on u.id = a."actorUserId"
         where a.action = $1 and a."entityId" = $2
         order by a."createdAt" desc
         limit 1`,
        ["EXPORT_DOWNLOADED", entityId],
      );
      return result.rows[0];
    });

    if (!audit) {
      throw new Error("Expected an EXPORT_DOWNLOADED audit row.");
    }

    expect(audit.actorEmail).toBe(CLUB_ADMIN_EMAIL);
    expect(audit.entityType).toBe("Export");
    expect(audit.metadata).toMatchObject({
      kind: "club-attendance",
      format: "csv",
      scope: eventId,
    });
    expect(JSON.stringify(audit.metadata)).not.toContain("Roll number");

    const limiterRows = await withDatabase(async (client) => {
      const result = await client.query<{ count: string }>(
        'select count(*)::text as count from "rate_limit_entries"',
      );
      return Number(result.rows[0]?.count ?? "0");
    });
    expect(limiterRows).toBeGreaterThan(0);
  } finally {
    await context.close();
    await withDatabase(async (client) => {
      await client.query('delete from "audit_logs" where action = $1 and "entityId" = $2', [
        "EXPORT_DOWNLOADED",
        entityId,
      ]);
    });
    await clearDevelopmentRateLimits();
  }
});

test("Prompt 9 login and dashboard keep keyboard and responsive access", async ({ browser }) => {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();

  try {
    await page.goto("/login");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toHaveAccessibleName("Password");
    await expect(page.locator('label[for="password"]')).toContainText("Password");
    await expectNoHorizontalOverflow(page);
    await screenshot(page, "login-375.png");

    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveText("Skip to content");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("main-content");

    await login(page, STUDENT_EMAIL);
    await page.goto("/student");
    await expect(page.locator("main#dashboard-main")).toBeVisible();
    await expect(page.locator("main#dashboard-main")).toHaveAttribute("tabindex", "-1");
    await expect(page.locator("h1")).toHaveCount(1);

    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalOverflow(page);
      await screenshot(page, `student-${width}.png`);
    }
  } finally {
    await context.close();
  }
});

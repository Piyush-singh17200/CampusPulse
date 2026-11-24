import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";

const PASSWORD = "CampusPulse!2026";
const CLUB_ADMIN_EMAIL = "robotics.president@campuspulse.example";
const STUDENT_EMAIL = "isha.rao@campuspulse.example";
const COLLEGE_ADMIN_EMAIL = "northfield.admin@campuspulse.example";
const PLATFORM_ADMIN_EMAIL = "platform.admin@campuspulse.example";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const SCREENSHOT_DIR = path.join(process.cwd(), "docs", "screenshots", "prompt-8");

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
  // sessions for four seeded roles. Clear stale limiter windows so repeat
  // local runs remain deterministic without changing the application policy.
  await withDatabase(async (client) => {
    await client.query('delete from "rate_limit_entries"');
  });
}

async function moveEventIntoAttendanceWindow(eventId: string): Promise<void> {
  const now = Date.now();
  await withDatabase(async (client) => {
    await client.query(
      `update events
       set "startsAt" = $2,
           "endsAt" = $3,
           "registrationOpensAt" = $4,
           "registrationDeadline" = $5,
           "updatedAt" = now()
       where id = $1`,
      [
        eventId,
        new Date(now - 45 * 60 * 1000),
        new Date(now - 10 * 60 * 1000),
        new Date(now - 3 * 60 * 60 * 1000),
        new Date(now - 60 * 60 * 1000),
      ],
    );
  });
}

async function registrationIdFor(eventId: string, email: string): Promise<string> {
  return withDatabase(async (client) => {
    const result = await client.query<{ id: string }>(
      `select r.id
       from event_registrations r
       join student_profiles sp on sp.id = r."studentProfileId" and sp."collegeId" = r."collegeId"
       join users u on u.id = sp."userId"
       where r."eventId" = $1 and u.email = $2
       limit 1`,
      [eventId, email],
    );
    const id = result.rows[0]?.id;
    if (!id) {
      throw new Error("The browser workflow registration was not found.");
    }
    return id;
  });
}

async function cleanupEvent(eventId: string, title: string): Promise<void> {
  await withDatabase(async (client) => {
    await client.query("begin");
    try {
      const registrations = await client.query<{ id: string }>(
        'select id from event_registrations where "eventId" = $1',
        [eventId],
      );
      const credentials = await client.query<{ id: string }>(
        'select id from attendance_credentials where "eventId" = $1',
        [eventId],
      );
      const feedback = await client.query<{ id: string }>(
        'select id from event_feedback where "eventId" = $1',
        [eventId],
      );
      const entityIds = [
        eventId,
        ...registrations.rows.map((row) => row.id),
        ...credentials.rows.map((row) => row.id),
        ...feedback.rows.map((row) => row.id),
      ];

      await client.query('delete from attendance_credentials where "eventId" = $1', [eventId]);
      await client.query('delete from event_feedback where "eventId" = $1', [eventId]);
      await client.query('delete from event_registrations where "eventId" = $1', [eventId]);
      await client.query('delete from notifications where "title" ilike $1 or "body" ilike $1', [
        `%${title}%`,
      ]);
      await client.query('delete from audit_logs where "entityId" = any($1::text[])', [entityIds]);
      await client.query("delete from events where id = $1", [eventId]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

function localDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
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

function watchPage(page: Page, label: string, errors: string[]): void {
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`${label}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`${label}: pageerror: ${error.message}`);
  });
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

async function createDraft(
  page: Page,
  input: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    registrationOpensAt: Date;
    registrationDeadline: Date;
  },
): Promise<{ eventId: string; clubId: string }> {
  await page.goto("/club/events/create");
  await page.getByLabel("Event title").fill(input.title);
  await page.getByLabel("Short summary").fill(`Prompt 8 workflow for ${input.title}.`);
  await page
    .getByLabel("Full description")
    .fill("A deterministic event created by the Prompt 8 browser workflow.");
  await page.getByLabel("Starts at").fill(localDateTime(input.startsAt));
  await page.getByLabel("Ends at").fill(localDateTime(input.endsAt));
  await page.getByLabel("Registration opens").fill(localDateTime(input.registrationOpensAt));
  await page.getByLabel("Registration deadline").fill(localDateTime(input.registrationDeadline));
  await page.getByLabel("Venue name").fill("Northfield Innovation Hall");
  await page.getByLabel("Venue address").fill("Northfield campus");
  await page.getByLabel("Capacity").fill("30");
  await page.getByRole("checkbox", { name: "Academic", exact: true }).check();
  await page.getByRole("checkbox", { name: "Technology", exact: true }).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/club\/events\/[0-9a-f-]+\?club=/);

  const url = new URL(page.url());
  const eventId = url.pathname.split("/")[3] ?? "";
  const clubId = url.searchParams.get("club") ?? "";
  expect(eventId).toMatch(/^[0-9a-f-]{36}$/);
  expect(clubId).toMatch(/^[0-9a-f-]{36}$/);
  return { eventId, clubId };
}

test("Prompt 8 attendance, feedback, calendar, exports, analytics, and notifications", async ({
  page,
  browser,
}) => {
  test.setTimeout(420_000);
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await clearDevelopmentRateLimits();

  const clientErrors: string[] = [];
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /content security policy|refused to (load|execute|apply|connect)/i.test(message.text())
    ) {
      cspErrors.push(message.text());
    }
  });
  watchPage(page, "club", clientErrors);

  let eventId = "";
  let clubId = "";
  let collegeContext: Awaited<ReturnType<typeof newLoggedInPage>>["context"] | null = null;
  let studentContext: Awaited<ReturnType<typeof newLoggedInPage>>["context"] | null = null;
  let platformContext: Awaited<ReturnType<typeof newLoggedInPage>>["context"] | null = null;
  const title = `Prompt 8 Campus Operations ${Date.now()}`;
  const startsAt = new Date(Date.now() + 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  const registrationOpensAt = new Date(Date.now() - 60 * 60 * 1000);
  const registrationDeadline = new Date(Date.now() + 30 * 60 * 1000);

  try {
    await login(page, CLUB_ADMIN_EMAIL);
    const draft = await createDraft(page, {
      title,
      startsAt,
      endsAt,
      registrationOpensAt,
      registrationDeadline,
    });
    eventId = draft.eventId;
    clubId = draft.clubId;

    await page.goto(`/club/events/${eventId}?club=${clubId}`);
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByRole("button", { name: "Withdraw event" })).toBeVisible();

    const college = await newLoggedInPage(browser, COLLEGE_ADMIN_EMAIL);
    collegeContext = college.context;
    const collegePage = college.page;
    watchPage(collegePage, "college", clientErrors);

    await collegePage.goto(`/college/events/${eventId}`);
    await collegePage.getByRole("button", { name: "Approve and publish" }).click();
    await expect(collegePage.getByRole("button", { name: "Approve and publish" })).toHaveCount(0);
    await expect(collegePage.getByText("Published", { exact: true }).first()).toBeVisible();

    const student = await newLoggedInPage(browser, STUDENT_EMAIL);
    studentContext = student.context;
    const studentPage = student.page;
    watchPage(studentPage, "student", clientErrors);

    await studentPage.goto(`/student/events/${eventId}`);
    await expect(studentPage.getByRole("heading", { name: title })).toBeVisible();
    await studentPage.getByRole("button", { name: "Register for this event" }).click();
    await expect(studentPage.getByText("You are registered.")).toBeVisible();

    await moveEventIntoAttendanceWindow(eventId);
    const registrationId = await registrationIdFor(eventId, STUDENT_EMAIL);

    await studentPage.goto(`/student/registrations/${registrationId}/attendance`);
    await expect(studentPage.getByRole("heading", { name: title })).toBeVisible();
    await expect(studentPage.getByText("Attendance QR", { exact: true })).toBeVisible();
    await studentPage.getByRole("button", { name: "Show attendance QR" }).click();
    await expect(studentPage.getByText("QR ready", { exact: true })).toBeVisible();
    const manualCode = await studentPage.locator("code").first().textContent();
    expect(manualCode?.trim().length).toBeGreaterThan(20);

    await page.goto(`/club/attendance?club=${clubId}&eventId=${eventId}`);
    await expect(page.getByRole("heading", { name: "Record who showed up." })).toBeVisible();
    await expect(page.locator("p").filter({ hasText: title }).first()).toBeVisible();
    await page.getByLabel("Manual attendance code").fill(manualCode?.trim() ?? "");
    await page.getByRole("button", { name: "Check manual code" }).click();
    await expect(page.getByText("Check-in recorded", { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: "Isha Rao" })
        .getByText("Attended", { exact: true })
        .first(),
    ).toBeVisible();
    await screenshot(page, "01-club-attendance-1440.png");

    const attendanceCsv = await page.request.get(
      `/api/exports/club/attendance?clubId=${clubId}&eventId=${eventId}`,
    );
    expect(attendanceCsv.status()).toBe(200);
    expect(attendanceCsv.headers()["content-type"]).toContain("text/csv");
    const attendanceBytes = await attendanceCsv.body();
    expect([...attendanceBytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    await collegePage.goto(`/college/events/${eventId}`);
    await collegePage.getByRole("button", { name: "Mark completed" }).click();
    await expect(collegePage.getByRole("button", { name: "Mark completed" })).toHaveCount(0);
    await expect(collegePage.getByText("Completed", { exact: true }).first()).toBeVisible();

    await studentPage.goto("/student/feedback");
    const feedbackCard = studentPage
      .locator("section")
      .filter({ has: studentPage.getByRole("heading", { name: title, exact: true }) });
    await expect(feedbackCard).toBeVisible();
    await feedbackCard.getByRole("radio", { name: /Excellent/ }).check({ force: true });
    await feedbackCard
      .getByPlaceholder("What worked well? What could the organizers improve next time?")
      .fill("Clear organization and a practical session.");
    await feedbackCard.getByRole("button", { name: "Submit feedback" }).click();
    await expect(
      feedbackCard.getByText("Thank you. Your feedback was submitted.", { exact: true }),
    ).toBeVisible();
    await studentPage.reload();
    const submittedCard = studentPage
      .locator("section")
      .filter({ has: studentPage.getByRole("heading", { name: title, exact: true }) });
    await expect(submittedCard.getByText("Feedback submitted", { exact: true })).toBeVisible();
    await screenshot(studentPage, "02-student-feedback-1440.png");

    const registeredIcs = await studentPage.request.get("/api/calendar/registered");
    expect(registeredIcs.status()).toBe(200);
    expect(registeredIcs.headers()["content-type"]).toContain("text/calendar");
    expect(await registeredIcs.text()).toContain(title);
    const singleIcs = await studentPage.request.get(`/api/calendar/events/${eventId}`);
    expect(singleIcs.status()).toBe(200);
    expect(await singleIcs.text()).toContain(title);
    const savedIcs = await studentPage.request.get("/api/calendar/saved");
    expect(savedIcs.status()).toBe(200);
    expect(savedIcs.headers()["content-type"]).toContain("text/calendar");

    await collegePage.goto("/college/feedback");
    await expect(collegePage.locator("p").filter({ hasText: title }).first()).toBeVisible();
    await expect(
      collegePage.getByText("Clear organization and a practical session.", { exact: true }),
    ).toBeVisible();
    await screenshot(collegePage, "03-college-feedback-1440.png");

    await page.goto("/club/feedback");
    await expect(page.locator("p").filter({ hasText: title }).first()).toBeVisible();
    await expect(
      page.getByText("Clear organization and a practical session.", { exact: true }),
    ).toBeVisible();
    await screenshot(page, "04-club-feedback-1440.png");

    await page.goto(`/club/analytics?club=${clubId}&from=2020-01-01&to=2030-01-01`);
    await expect(page.getByRole("heading", { name: "How your club is moving." })).toBeVisible();
    await expect(page.getByText("Attendance rate", { exact: true })).toBeVisible();
    await expect(page.getByText("Present", { exact: true })).toBeVisible();
    await expect(page.getByText("5.0", { exact: true }).first()).toBeVisible();
    await screenshot(page, "05-club-analytics-1440.png");
    const clubAnalyticsCsv = await page.request.get(
      `/api/exports/club/analytics?clubId=${clubId}&from=2020-01-01&to=2030-01-01`,
    );
    expect(clubAnalyticsCsv.status()).toBe(200);
    expect(await clubAnalyticsCsv.text()).toContain(title);

    await collegePage.goto("/college/analytics?from=2020-01-01&to=2030-01-01");
    await expect(
      collegePage.getByRole("heading", { name: "A factual view of campus activity." }),
    ).toBeVisible();
    await expect(collegePage.locator("td, p").filter({ hasText: title }).first()).toBeVisible();
    await screenshot(collegePage, "06-college-analytics-1440.png");
    const collegeAnalyticsCsv = await collegePage.request.get(
      "/api/exports/college/analytics?from=2020-01-01&to=2030-01-01",
    );
    expect(collegeAnalyticsCsv.status()).toBe(200);
    expect(await collegeAnalyticsCsv.text()).toContain(title);

    const platform = await newLoggedInPage(browser, PLATFORM_ADMIN_EMAIL);
    platformContext = platform.context;
    const platformPage = platform.page;
    watchPage(platformPage, "platform", clientErrors);
    await platformPage.goto("/platform/analytics?from=2020-01-01&to=2030-01-01");
    await expect(
      platformPage.getByRole("heading", { name: "Network-level activity, without estimates." }),
    ).toBeVisible();
    await expect(platformPage.getByText("Active colleges", { exact: true })).toBeVisible();
    await screenshot(platformPage, "07-platform-analytics-1440.png");
    const platformAnalyticsCsv = await platformPage.request.get(
      "/api/exports/platform/analytics?from=2020-01-01&to=2030-01-01",
    );
    expect(platformAnalyticsCsv.status()).toBe(200);
    expect(await platformAnalyticsCsv.text()).toContain("Northfield");

    await studentPage.goto("/student/notifications");
    await expect(
      studentPage.getByRole("heading", { name: "Updates from your campus." }),
    ).toBeVisible();
    await expect(studentPage.getByText("Notification preferences", { exact: true })).toBeVisible();
    await expect(studentPage.getByText(title, { exact: false }).first()).toBeVisible();
    await screenshot(studentPage, "08-student-notifications-1440.png");

    await studentPage.getByRole("link", { name: /^Unread/ }).click();
    await expect(studentPage.getByRole("heading", { name: "Unread notifications" })).toBeVisible();
    const markRead = studentPage.getByRole("button", { name: "Mark read" }).first();
    if (await markRead.isVisible()) {
      await markRead.click();
      await expect(
        studentPage.getByRole("heading", { name: "Unread notifications" }),
      ).toBeVisible();
    }

    const attendancePreference = studentPage.getByRole("checkbox", {
      name: "Attendance notifications",
    });
    await attendancePreference.uncheck();
    await studentPage.getByRole("button", { name: "Save preferences" }).click();
    await expect(
      studentPage.getByText("Notification preferences saved.", { exact: true }),
    ).toBeVisible();
    await studentPage.reload();
    await expect(
      studentPage.getByRole("checkbox", { name: "Attendance notifications" }),
    ).not.toBeChecked();
    await studentPage.getByRole("checkbox", { name: "Attendance notifications" }).check();
    await studentPage.getByRole("button", { name: "Save preferences" }).click();
    await expect(
      studentPage.getByText("Notification preferences saved.", { exact: true }),
    ).toBeVisible();

    await studentPage.setViewportSize({ width: 390, height: 844 });
    await studentPage.goto("/student/notifications");
    await expect(
      studentPage.getByRole("heading", { name: "Updates from your campus." }),
    ).toBeVisible();
    const overflow = await studentPage.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
    await screenshot(studentPage, "09-student-notifications-390.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/club/attendance?club=${clubId}&eventId=${eventId}`);
    await expect(page.getByRole("heading", { name: "Record who showed up." })).toBeVisible();
    const attendanceOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(attendanceOverflow).toBe(false);
    await screenshot(page, "10-club-attendance-390.png");

    expect(cspErrors).toEqual([]);
    expect(clientErrors).toEqual([]);
  } finally {
    await collegeContext?.close();
    await studentContext?.close();
    await platformContext?.close();
    if (eventId) {
      await cleanupEvent(eventId, title).catch(() => undefined);
    }
  }
});

test("Prompt 8 authenticated exports reject unauthenticated callers", async ({ request }) => {
  const response = await request.get("/api/exports/club/attendance", {
    headers: { accept: "text/csv" },
    maxRedirects: 0,
  });
  expect([401, 403]).toContain(response.status());
});

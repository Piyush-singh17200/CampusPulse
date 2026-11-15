import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = "CampusPulse!2026";
const CLUB_ADMIN_EMAIL = "robotics.president@campuspulse.example";
const STUDENT_EMAIL = "isha.rao@campuspulse.example";
const COLLEGE_ADMIN_EMAIL = "northfield.admin@campuspulse.example";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const SCREENSHOT_DIR = path.join(process.cwd(), "docs", "screenshots", "prompt-7");

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
  const context = await browser.newContext({ baseURL: BASE_URL });
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

async function createReadablePoster(browser: Browser): Promise<Buffer> {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  await page.setContent(`
    <!doctype html>
    <html>
      <body style="margin:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;">
        <div style="padding:64px 80px;">
          <div style="font-size:84px;font-weight:800;letter-spacing:1px;line-height:1.1;">ROBOTICS SHOWCASE</div>
          <div style="margin-top:28px;font-size:48px;font-weight:600;">Student robotics demonstrations</div>
          <div style="margin-top:34px;font-size:46px;line-height:1.55;">
            <div>Date: 20 December 2026</div>
            <div>Time: 10:00 AM - 12:00 PM</div>
            <div>Venue: Northfield Innovation Hall</div>
            <div>Organized by Robotics Club</div>
            <div>Contact: robotics@example.edu</div>
            <div>Registration deadline: 18 December 2026</div>
            <div>Technology workshop</div>
          </div>
        </div>
      </body>
    </html>
  `);
  const bytes = await page.screenshot({ type: "png" });
  await context.close();
  return bytes;
}

async function createDraft(
  page: Page,
  input: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    registrationOpensAt: Date;
    registrationDeadline: Date;
    venueName: string;
    capacity?: string;
    category: string;
    interest: string;
    poster?: Buffer;
    posterAlt?: string;
  },
): Promise<{ eventId: string; clubId: string }> {
  await page.goto("/club/events/create");
  await page.getByLabel("Event title").fill(input.title);
  await page.getByLabel("Short summary").fill(`Prompt 7 workflow for ${input.title}.`);
  await page
    .getByLabel("Full description")
    .fill("A deterministic event created by the Prompt 7 browser workflow.");
  await page.getByLabel("Starts at").fill(localDateTime(input.startsAt));
  await page.getByLabel("Ends at").fill(localDateTime(input.endsAt));
  await page.getByLabel("Registration opens").fill(localDateTime(input.registrationOpensAt));
  await page.getByLabel("Registration deadline").fill(localDateTime(input.registrationDeadline));
  await page.getByLabel("Venue name").fill(input.venueName);
  await page.getByLabel("Venue address").fill("Northfield campus");
  await page.getByLabel("Capacity").fill(input.capacity ?? "30");
  await page.getByRole("checkbox", { name: input.category, exact: true }).check();
  await page.getByRole("checkbox", { name: input.interest, exact: true }).check();

  if (input.poster) {
    await page.locator('input[name="poster"]').setInputFiles({
      name: "prompt-7-ocr-poster.png",
      mimeType: "image/png",
      buffer: input.poster,
    });
    await page.getByLabel("Poster alt text").fill(input.posterAlt ?? "Prompt 7 OCR poster");
    await expect(page.getByAltText("Selected poster preview")).toBeVisible();
  }

  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/club\/events\/[0-9a-f-]+\?club=/);

  const url = new URL(page.url());
  const eventId = url.pathname.split("/")[3] ?? "";
  const clubId = url.searchParams.get("club") ?? "";
  expect(eventId).toMatch(/^[0-9a-f-]{36}$/);
  expect(clubId).toMatch(/^[0-9a-f-]{36}$/);
  return { eventId, clubId };
}

async function submitEvent(page: Page, eventId: string, clubId: string): Promise<void> {
  await page.goto(`/club/events/${eventId}?club=${clubId}`);
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByRole("button", { name: "Withdraw event" })).toBeVisible();
}

async function approveEvent(page: Page, eventId: string): Promise<void> {
  await page.goto(`/college/events/${eventId}`);
  await page.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page.getByRole("button", { name: "Approve and publish" })).toHaveCount(0);
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
}

test("Prompt 7 OCR review, recommendations, duplicate review, conflicts, and responsive layouts", async ({
  page,
  browser,
}) => {
  test.setTimeout(360_000);
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const cspErrors: string[] = [];
  const clientErrors: string[] = [];
  watchPage(page, "club", clientErrors);
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /content security policy|refused to (load|execute|apply|connect)/i.test(message.text())
    ) {
      cspErrors.push(message.text());
    }
  });

  const stamp = Date.now();
  const title1 = `Prompt 7 OCR Robotics ${stamp}`;
  const title2 = `${title1} Session`;
  const title3 = `Prompt 7 Technology Mixer ${stamp}`;
  // Vary the date across runs so an earlier workflow run's published events do
  // not become legitimate same-day duplicate candidates for this run.
  const startsAt = new Date(Date.now() + (60 + (stamp % 250)) * 24 * 60 * 60 * 1000);
  startsAt.setHours(10, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  const registrationOpensAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const registrationDeadline = new Date(startsAt.getTime() - 60 * 60 * 1000);
  const recommendedStartsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  recommendedStartsAt.setHours(14, 0, 0, 0);
  const recommendedEndsAt = new Date(recommendedStartsAt.getTime() + 2 * 60 * 60 * 1000);

  let collegeContext: Awaited<ReturnType<typeof newLoggedInPage>>["context"] | null = null;
  let studentContext: Awaited<ReturnType<typeof newLoggedInPage>>["context"] | null = null;

  try {
    const posterBytes = await createReadablePoster(browser);
    await login(page, CLUB_ADMIN_EMAIL);

    const first = await createDraft(page, {
      title: title1,
      startsAt,
      endsAt,
      registrationOpensAt,
      registrationDeadline,
      venueName: "Northfield Innovation Hall",
      category: "Academic",
      interest: "Technology",
      poster: posterBytes,
      posterAlt: "Prompt 7 OCR robotics poster",
    });

    // OCR review and an explicitly edited accepted value.
    await page.goto(`/club/events/${first.eventId}/edit?club=${first.clubId}`);
    await expect(page.getByRole("heading", { name: "Poster details (OCR)" })).toBeVisible();
    await expect(page.getByText("Not started", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Extract details" }).click();
    await expect(page.getByText("Ready to review", { exact: true })).toBeVisible({
      timeout: 180_000,
    });
    await expect(page.getByText("Review each suggestion.", { exact: false })).toBeVisible();
    await screenshot(page, "01-club-ocr-review-1440.png");

    await page.getByLabel("Venue review decision").selectOption("ACCEPT");
    await page.getByLabel("Venue value").fill("OCR Main Auditorium");
    await page.getByRole("button", { name: "Save OCR review" }).click();
    await expect(page.getByText("Reviewed", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByRole("heading", { name: title1 })).toBeVisible();
    await expect(page.getByLabel("Venue name")).toHaveValue("OCR Main Auditorium");
    await expect(page.getByLabel("Venue review decision")).toHaveValue("ACCEPT");
    await screenshot(page, "02-club-ocr-applied-1440.png");

    await submitEvent(page, first.eventId, first.clubId);

    // A second, similar same-day event should create an advisory duplicate.
    const second = await createDraft(page, {
      title: title2,
      startsAt,
      endsAt,
      registrationOpensAt,
      registrationDeadline,
      venueName: "OCR Main Auditorium",
      category: "Academic",
      interest: "Technology",
    });
    await submitEvent(page, second.eventId, second.clubId);

    const college = await newLoggedInPage(browser, COLLEGE_ADMIN_EMAIL);
    collegeContext = college.context;
    const collegePage = college.page;
    watchPage(collegePage, "college", clientErrors);

    await collegePage.goto("/college/approvals");
    const duplicateCard = collegePage
      .locator("article")
      .filter({ has: collegePage.getByRole("link", { name: title1, exact: true }) })
      .filter({ has: collegePage.getByRole("link", { name: title2, exact: true }) });
    await expect(duplicateCard).toBeVisible({ timeout: 30_000 });
    await expect(duplicateCard.getByText("Possible duplicate", { exact: true })).toBeVisible();
    await screenshot(collegePage, "03-college-duplicate-review-1440.png");
    await duplicateCard.screenshot({
      path: path.join(SCREENSHOT_DIR, "03b-college-duplicate-card-1440.png"),
      caret: "initial",
    });

    await duplicateCard.getByRole("button", { name: "Confirm duplicate" }).click();
    await expect(duplicateCard).toHaveCount(0, { timeout: 30_000 });

    await collegePage.goto(`/college/events/${second.eventId}`);
    await expect(collegePage.getByText("Pending Approval", { exact: true }).first()).toBeVisible();
    await expect(collegePage.getByRole("button", { name: "Approve and publish" })).toBeVisible();
    await approveEvent(collegePage, first.eventId);
    await approveEvent(collegePage, second.eventId);

    // A third, non-overlapping event gives the seeded student an eligible
    // interest match after the first two events are registered.
    const third = await createDraft(page, {
      title: title3,
      startsAt: recommendedStartsAt,
      endsAt: recommendedEndsAt,
      registrationOpensAt,
      registrationDeadline: new Date(recommendedStartsAt.getTime() - 60 * 60 * 1000),
      venueName: "Seminar Hall",
      category: "Career",
      interest: "Technology",
    });
    await submitEvent(page, third.eventId, third.clubId);
    await approveEvent(collegePage, third.eventId);

    const student = await newLoggedInPage(browser, STUDENT_EMAIL);
    studentContext = student.context;
    const studentPage = student.page;
    watchPage(studentPage, "student", clientErrors);

    await studentPage.goto(`/student/events/${first.eventId}`);
    await expect(studentPage.getByRole("heading", { name: title1 })).toBeVisible();
    await studentPage.getByRole("button", { name: "Register for this event" }).click();
    await expect(studentPage.getByText("You are registered.")).toBeVisible();

    await studentPage.goto(`/student/events/${second.eventId}`);
    await expect(studentPage.getByText("Schedule warning", { exact: true })).toBeVisible();
    await expect(studentPage.getByText(title1, { exact: false }).first()).toBeVisible();
    await screenshot(studentPage, "04-student-schedule-warning-1440.png");

    await studentPage.getByRole("button", { name: "Register for this event" }).click();
    await expect(studentPage.getByText(/Schedule warning: this overlaps with/)).toBeVisible();
    await expect(studentPage.getByText(/Your place is still reserved/)).toBeVisible();

    await studentPage.goto("/student/registrations");
    await expect(studentPage.getByText(/Overlaps with/).first()).toBeVisible();
    await screenshot(studentPage, "05-student-registrations-conflict-1440.png");

    await studentPage.goto("/student");
    await expect(studentPage.getByRole("heading", { name: "Picked for you" })).toBeVisible();
    await expect(
      studentPage.getByText("Matches your interest in Technology.").first(),
    ).toBeVisible();
    await expect(studentPage.getByText(title3, { exact: false }).first()).toBeVisible();
    await screenshot(studentPage, "06-student-recommendations-1440.png");

    // Required responsive verification for the conflict warning surface.
    for (const width of [360, 390, 768, 1024, 1280, 1440]) {
      await studentPage.setViewportSize({ width, height: 1000 });
      await studentPage.goto(`/student/events/${second.eventId}`);
      await expect(studentPage.getByText("Schedule warning", { exact: true })).toBeVisible();
      const overflows = await studentPage.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflows, `horizontal overflow at ${width}px`).toBe(false);
      await hideDevOverlay(studentPage);
      await studentPage.evaluate(() => window.scrollTo(0, 0));
      await studentPage.screenshot({
        path: path.join(SCREENSHOT_DIR, `responsive-schedule-warning-${width}.png`),
        fullPage: true,
        caret: "initial",
      });
    }
    await studentPage.setViewportSize({ width: 1440, height: 1000 });

    expect(cspErrors).toEqual([]);
    expect(clientErrors).toEqual([]);
  } finally {
    await collegeContext?.close();
    await studentContext?.close();
  }
});

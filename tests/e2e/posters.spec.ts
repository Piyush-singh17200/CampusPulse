import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { VALID_JPEG_BASE64, VALID_PNG_BASE64 } from "../helpers/images";

const PASSWORD = "CampusPulse!2026";
const CLUB_ADMIN_EMAIL = "robotics.president@campuspulse.example";
const STUDENT_EMAIL = "isha.rao@campuspulse.example";
const COLLEGE_ADMIN_EMAIL = "northfield.admin@campuspulse.example";
const OTHER_COLLEGE_STUDENT_EMAIL = "omar.ali@campuspulse.example";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const SCREENSHOT_DIR = path.join(process.cwd(), "docs", "screenshots", "posters");

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

async function expectImageLoaded(page: Page, src: string): Promise<void> {
  const image = page.locator(`img[src$="${src}"]`);
  await expect(image).toBeVisible();
  await expect
    .poll(async () =>
      image.evaluate((node) => {
        const element = node as HTMLImageElement;
        return element.complete && element.naturalWidth > 0;
      }),
    )
    .toBe(true);
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

test("Event poster lifecycle, access control, and responsive layouts", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(240_000);
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

  const title = `Robotics Poster ${Date.now()}`;
  const startsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  const registrationOpensAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const registrationDeadline = new Date(startsAt.getTime() - 60 * 60 * 1000);
  const pngBytes = Buffer.from(VALID_PNG_BASE64, "base64");
  const jpegBytes = Buffer.from(VALID_JPEG_BASE64, "base64");

  let studentContext: Awaited<ReturnType<typeof newLoggedInPage>>["context"] | null = null;
  let collegeContext: Awaited<ReturnType<typeof newLoggedInPage>>["context"] | null = null;
  let otherCollegeContext: Awaited<ReturnType<typeof newLoggedInPage>>["context"] | null = null;

  try {
    await login(page, CLUB_ADMIN_EMAIL);

    // Create a draft with a poster and verify the browser preview before saving.
    await page.goto("/club/events/create");
    await page.getByLabel("Event title").fill(title);
    await page
      .getByLabel("Short summary")
      .fill("A student robotics showcase used to verify poster operations.");
    await page
      .getByLabel("Full description")
      .fill("Join the robotics club for demonstrations, posters, and a student Q&A.");
    await page.getByLabel("Starts at").fill(localDateTime(startsAt));
    await page.getByLabel("Ends at").fill(localDateTime(endsAt));
    await page.getByLabel("Registration opens").fill(localDateTime(registrationOpensAt));
    await page.getByLabel("Registration deadline").fill(localDateTime(registrationDeadline));
    await page.getByLabel("Venue name").fill("Northfield Innovation Hall");
    await page.getByLabel("Venue address").fill("Block C, ground floor");
    await page.getByLabel("Capacity").fill("25");
    await page.locator('input[name="poster"]').setInputFiles({
      name: "robotics-poster.png",
      mimeType: "image/png",
      buffer: pngBytes,
    });
    await page.getByLabel("Poster alt text").fill("Robotics students presenting a poster");
    await expect(page.getByAltText("Selected poster preview")).toBeVisible();
    await screenshot(page, "01-club-create-poster-preview-1440.png");

    await page.getByRole("button", { name: "Save draft" }).click();
    await page.waitForURL(/\/club\/events\/[0-9a-f-]+\?club=/);

    const eventUrl = new URL(page.url());
    const eventId = eventUrl.pathname.split("/")[3] ?? "";
    const clubId = eventUrl.searchParams.get("club") ?? "";
    expect(eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(clubId).toMatch(/^[0-9a-f-]{36}$/);

    const posterImage = page.getByAltText("Robotics students presenting a poster");
    await expect(posterImage).toBeVisible();
    const posterSource = await posterImage.getAttribute("src");
    expect(posterSource).not.toBeNull();
    const posterPath = new URL(posterSource!, BASE_URL).pathname;
    expect(posterPath).toMatch(/^\/api\/posters\/[0-9a-f-]{36}$/);
    await expectImageLoaded(page, posterPath!);
    await screenshot(page, "02-club-draft-with-poster-1440.png");

    // Unauthenticated and same-college-student requests cannot read a draft poster.
    const anonymousResponse = await request.get(posterPath!);
    expect(anonymousResponse.status()).toBe(401);

    const student = await newLoggedInPage(browser, STUDENT_EMAIL);
    studentContext = student.context;
    const studentPage = student.page;
    watchPage(studentPage, "student", clientErrors);

    await studentPage.goto(`/student/events/${eventId}`);
    await expect(
      studentPage.getByRole("heading", { name: "That page does not exist." }),
    ).toBeVisible();
    const draftPosterResponse = await studentPage.request.get(posterPath!);
    expect(draftPosterResponse.status()).toBe(404);

    // Submit and approve the event as the college administrator.
    await page.goto(`/club/events/${eventId}?club=${clubId}`);
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByRole("button", { name: "Withdraw event" })).toBeVisible();

    const college = await newLoggedInPage(browser, COLLEGE_ADMIN_EMAIL);
    collegeContext = college.context;
    const collegePage = college.page;
    watchPage(collegePage, "college", clientErrors);

    const collegeEventResponse = await collegePage.goto(`/college/events/${eventId}`);
    expect(collegeEventResponse?.status()).toBe(200);
    await expect(collegePage.getByRole("heading", { name: title })).toBeVisible();
    await expectImageLoaded(collegePage, posterPath!);
    await screenshot(collegePage, "03-college-approval-with-poster-1440.png");

    await collegePage.getByRole("button", { name: "Approve and publish" }).click();
    await expect(collegePage.getByRole("button", { name: "Approve and publish" })).toHaveCount(0);
    await expect(collegePage.getByText("Published", { exact: true }).first()).toBeVisible();

    // A published poster is visible to a same-college student.
    const publishedEventResponse = await studentPage.goto(`/student/events/${eventId}`);
    expect(publishedEventResponse?.status()).toBe(200);
    await expect(studentPage.getByRole("heading", { name: title })).toBeVisible();
    await expectImageLoaded(studentPage, posterPath!);
    const publishedPosterResponse = await studentPage.request.get(posterPath!);
    expect(publishedPosterResponse.status()).toBe(200);
    expect(publishedPosterResponse.headers()["content-type"]).toContain("image/png");
    expect(publishedPosterResponse.headers()["x-content-type-options"]).toBe("nosniff");
    expect(publishedPosterResponse.headers()["cache-control"]).toContain("no-store");
    await screenshot(studentPage, "04-student-event-with-poster-1440.png");

    // Register, verify the in-app notification, and confirm the club sees the registration.
    await studentPage.getByRole("button", { name: "Register for this event" }).click();
    await expect(studentPage.getByText("You are registered.")).toBeVisible();
    await screenshot(studentPage, "05-student-registered-1440.png");

    await studentPage.goto("/student/notifications");
    await expect(studentPage.getByText("Registration confirmed").first()).toBeVisible();

    await page.goto(`/club/registrations?club=${clubId}&eventId=${eventId}`);
    await expect(page.getByText("Isha Rao", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
    await screenshot(page, "06-club-registration-list-1440.png");

    // Cancel and verify the cancellation notification.
    await studentPage.goto(`/student/events/${eventId}`);
    await studentPage.getByRole("button", { name: "Cancel registration" }).click();
    await expect(studentPage.getByText("Your previous registration was cancelled.")).toBeVisible();
    await studentPage.goto("/student/notifications");
    await expect(studentPage.getByText("Registration cancelled").first()).toBeVisible();
    await screenshot(studentPage, "07-student-cancellation-notification-1440.png");

    // Replace the poster on a published event.
    await page.goto(`/club/events/${eventId}/edit?club=${clubId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.locator('input[name="poster"]').setInputFiles({
      name: "robotics-replacement.jpg",
      mimeType: "image/jpeg",
      buffer: jpegBytes,
    });
    await page.getByLabel("Poster alt text").fill("Replacement robotics poster");
    await expect(page.getByAltText("Selected poster preview")).toBeVisible();
    await page.locator('button[type="submit"]').filter({ hasText: "Replace poster" }).click();
    await expect(page.getByText("Poster uploaded.")).toBeVisible();

    const replacementImage = page.getByAltText("Replacement robotics poster");
    await expect(replacementImage).toBeVisible();
    const replacementSource = await replacementImage.getAttribute("src");
    expect(replacementSource).not.toBeNull();
    const replacementPath = new URL(replacementSource!, BASE_URL).pathname;
    expect(replacementPath).toMatch(/^\/api\/posters\/[0-9a-f-]{36}$/);
    expect(replacementPath).not.toBe(posterPath);
    await screenshot(page, "08-club-replacement-poster-1440.png");

    // The new poster is visible to students; the old asset is gone.
    await studentPage.goto(`/student/events/${eventId}`);
    await expectImageLoaded(studentPage, replacementPath!);
    await expect(studentPage.locator(`img[src$="${posterPath}"]`)).toHaveCount(0);
    const oldPosterResponse = await studentPage.request.get(posterPath!);
    expect(oldPosterResponse.status()).toBe(404);
    const replacementResponse = await studentPage.request.get(replacementPath!);
    expect(replacementResponse.status()).toBe(200);
    expect(replacementResponse.headers()["content-type"]).toContain("image/jpeg");
    await screenshot(studentPage, "09-student-replacement-poster-1440.png");

    // A student from another college cannot see the event or its poster.
    const otherCollege = await newLoggedInPage(browser, OTHER_COLLEGE_STUDENT_EMAIL);
    otherCollegeContext = otherCollege.context;
    const otherCollegePage = otherCollege.page;
    watchPage(otherCollegePage, "other-college", clientErrors);
    await otherCollegePage.goto(`/student/events/${eventId}`);
    await expect(
      otherCollegePage.getByRole("heading", { name: "That page does not exist." }),
    ).toBeVisible();
    const otherCollegePosterResponse = await otherCollegePage.request.get(replacementPath!);
    expect(otherCollegePosterResponse.status()).toBe(404);

    // Verify the student event page at all required responsive widths.
    for (const width of [360, 390, 768, 1024, 1280, 1440]) {
      await studentPage.setViewportSize({ width, height: 1000 });
      await studentPage.goto(`/student/events/${eventId}`);
      await expectImageLoaded(studentPage, replacementPath!);
      const overflows = await studentPage.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflows, `horizontal overflow at ${width}px`).toBe(false);
      await hideDevOverlay(studentPage);
      await studentPage.evaluate(() => window.scrollTo(0, 0));
      await studentPage.screenshot({
        path: path.join(SCREENSHOT_DIR, `responsive-student-${width}.png`),
        fullPage: true,
        caret: "initial",
      });
    }
    await studentPage.setViewportSize({ width: 1440, height: 1000 });

    // Remove the poster and verify the safe empty state and asset revocation.
    await page.goto(`/club/events/${eventId}/edit?club=${clubId}`);
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Remove poster" }).click();
    await expect(page.getByText("Poster removed.")).toBeVisible();
    await expect(page.getByText("No poster yet")).toBeVisible();

    await studentPage.goto(`/student/events/${eventId}`);
    await expect(
      studentPage.getByText("No poster has been published for this event."),
    ).toBeVisible();
    await expect(studentPage.locator('img[src*="/api/posters/"]')).toHaveCount(0);
    const removedPosterResponse = await studentPage.request.get(replacementPath!);
    expect(removedPosterResponse.status()).toBe(404);
    await screenshot(studentPage, "10-student-no-poster-1440.png");

    expect(cspErrors).toEqual([]);
    expect(clientErrors).toEqual([]);
  } finally {
    await studentContext?.close();
    await collegeContext?.close();
    await otherCollegeContext?.close();
  }
});

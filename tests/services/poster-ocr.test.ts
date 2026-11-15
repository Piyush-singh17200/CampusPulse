import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import type { OcrEngine } from "@/server/ocr/tesseract-engine";
import type { PosterStorage } from "@/server/storage/poster-storage";
import {
  applyPosterOcrReview,
  getPosterOcrReviewForEvent,
  processPosterOcr,
} from "@/services/poster-ocr";
import { uploadEventPoster } from "@/services/posters";
import { resetDatabase } from "@tests/helpers/db";
import { validPng } from "@tests/helpers/images";
import {
  actorForUser,
  createClub,
  createClubAdmin,
  createCollege,
  createEvent,
  createUser,
} from "@tests/helpers/factories";

const OCR_TEXT = [
  "ROBOTICS SHOWCASE",
  "Join us for a student robotics showcase.",
  "Date: 20 December 2026",
  "Time: 10:00 AM - 12:00 PM",
  "Venue: Main Auditorium",
  "Organized by Robotics Club",
  "Contact: robotics@example.edu",
  "Registration deadline: 18 December 2026",
  "Technology workshop",
].join("\n");

function createMemoryStorage() {
  const files = new Map<string, Buffer>();
  const storage: PosterStorage = {
    async put(key, data) {
      files.set(key, Buffer.from(data));
    },
    async get(key) {
      return files.get(key) ?? null;
    },
    async delete(key) {
      files.delete(key);
    },
  };

  return { files, storage };
}

function fakeEngine(
  result: Awaited<ReturnType<OcrEngine>> = {
    text: OCR_TEXT,
    words: [
      { text: "ROBOTICS", confidence: 91 },
      { text: "SHOWCASE", confidence: 88 },
    ],
    confidence: 89.5,
  },
): OcrEngine {
  return async () => result;
}

async function createOcrFixture() {
  const college = await createCollege();
  const creator = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
  const club = await createClub({ collegeId: college.id, createdById: creator.id });
  const clubAdmin = await createClubAdmin({ collegeId: college.id, clubId: club.id });
  const event = await createEvent({
    collegeId: college.id,
    clubId: club.id,
    createdById: clubAdmin.id,
    status: "DRAFT",
  });
  const actor = await actorForUser(clubAdmin.id);
  const { storage } = createMemoryStorage();
  const poster = await uploadEventPoster(
    actor,
    { eventId: event.id, bytes: validPng(), altText: "Robotics poster" },
    storage,
  );

  return { college, club, clubAdmin, event, actor, storage, poster };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("poster OCR service", () => {
  it("extracts and stores reviewable fields without changing the event", async () => {
    const { event, actor, storage, poster } = await createOcrFixture();

    const result = await processPosterOcr(
      actor,
      { posterId: poster.id },
      { engine: fakeEngine(), storage },
    );

    expect(result.status).toBe("COMPLETED");
    expect(result.fields).toHaveLength(14);
    expect(result.fields.find((field) => field.field === "TITLE")).toMatchObject({
      value: "ROBOTICS SHOWCASE",
      extractionStatus: "EXTRACTED",
      requiresReview: true,
    });

    const storedPoster = await prisma.eventPoster.findUniqueOrThrow({
      where: { id: poster.id },
      include: { ocrFields: true },
    });
    expect(storedPoster.ocrStatus).toBe("COMPLETED");
    expect(storedPoster.ocrCompletedAt).not.toBeNull();
    expect(storedPoster.ocrFields).toHaveLength(14);
    expect(storedPoster.ocrText).toContain("ROBOTICS SHOWCASE");

    const unchangedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(unchangedEvent.title).toBe(event.title);
    expect(unchangedEvent.venueName).toBe(event.venueName);
  });

  it("is idempotent and claims processing so duplicate requests do not run twice", async () => {
    const { actor, storage, poster } = await createOcrFixture();
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const processingStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let calls = 0;
    const engine: OcrEngine = async () => {
      calls += 1;
      started();
      await gate;
      return {
        text: OCR_TEXT,
        words: [],
        confidence: 89.5,
      };
    };

    const first = processPosterOcr(actor, { posterId: poster.id }, { engine, storage });
    await processingStarted;
    const second = await processPosterOcr(actor, { posterId: poster.id }, { engine, storage });

    expect(["PROCESSING", "COMPLETED"]).toContain(second.status);
    release();
    const completed = await first;

    expect(completed.status).toBe("COMPLETED");
    expect(calls).toBe(1);

    const repeated = await processPosterOcr(
      actor,
      { posterId: poster.id },
      {
        engine: async () => {
          throw new Error("The engine must not run again.");
        },
        storage,
      },
    );
    expect(repeated.status).toBe("COMPLETED");
    expect(repeated.fields).toHaveLength(14);
  });

  it("applies only accepted review decisions and records the review", async () => {
    const { event, actor, storage, poster } = await createOcrFixture();
    await processPosterOcr(actor, { posterId: poster.id }, { engine: fakeEngine(), storage });

    const review = await getPosterOcrReviewForEvent(actor, event.id);
    expect(review).not.toBeNull();
    if (!review) {
      throw new Error("Expected an OCR review");
    }

    const decisions = review.fields.map((field) => {
      if (field.field === "TITLE") {
        return {
          field: field.field,
          decision: "ACCEPT" as const,
          value: "Robotics Showcase 2026",
        };
      }
      if (field.field === "VENUE") {
        return { field: field.field, decision: "ACCEPT" as const };
      }
      return { field: field.field, decision: "PENDING" as const };
    });

    await applyPosterOcrReview(actor, {
      posterId: poster.id,
      eventId: event.id,
      decisions,
    });

    const updatedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(updatedEvent.title).toBe("Robotics Showcase 2026");
    expect(updatedEvent.venueName).toBe("Main Auditorium");
    expect(updatedEvent.status).toBe("DRAFT");

    const storedFields = await prisma.posterOcrField.findMany({
      where: { posterId: poster.id },
      orderBy: { field: "asc" },
    });
    expect(storedFields.find((field) => field.field === "TITLE")).toMatchObject({
      reviewStatus: "ACCEPTED",
      reviewedValue: "Robotics Showcase 2026",
    });
    expect(storedFields.find((field) => field.field === "VENUE")).toMatchObject({
      reviewStatus: "ACCEPTED",
      reviewedValue: "Main Auditorium",
    });
    expect(storedFields.find((field) => field.field === "SUMMARY")).toMatchObject({
      reviewStatus: "PENDING",
      reviewedValue: null,
    });

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: "Event",
        entityId: event.id,
        action: "EVENT_UPDATED",
        metadata: { path: ["source"], equals: "poster_ocr_review" },
      },
    });
    expect(audit?.actorUserId).toBe(actor.id);
    expect(audit?.metadata).toMatchObject({
      acceptedFields: expect.arrayContaining(["TITLE", "VENUE"]),
      appliedEventFields: expect.arrayContaining(["title", "venueName"]),
    });
  });

  it("records a safe failure and leaves the event untouched", async () => {
    const { event, actor, storage, poster } = await createOcrFixture();

    const result = await processPosterOcr(
      actor,
      { posterId: poster.id },
      {
        engine: async () => {
          throw new Error("internal worker exploded");
        },
        storage,
      },
    );

    expect(result.status).toBe("FAILED");
    expect(result.error).not.toContain("internal worker exploded");

    const storedPoster = await prisma.eventPoster.findUniqueOrThrow({
      where: { id: poster.id },
      include: { ocrFields: true },
    });
    expect(storedPoster.ocrStatus).toBe("FAILED");
    expect(storedPoster.ocrError).toBe(
      "The poster could not be processed. Try again or enter the event details manually.",
    );
    expect(storedPoster.ocrFields).toHaveLength(0);

    const unchangedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(unchangedEvent.title).toBe(event.title);
  });
});

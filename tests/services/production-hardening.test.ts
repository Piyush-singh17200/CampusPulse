import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as healthGET } from "@/app/api/health/route";
import { prisma } from "@/server/db/client";
import { RateLimitedError } from "@/server/errors";
import { consumeRateLimit, enforceRateLimit } from "@/server/auth/rate-limit";
import { recordExportAudit } from "@/server/exports/audit";
import { errorResponse } from "@/server/http/responses";
import type { OcrEngine } from "@/server/ocr/tesseract-engine";
import type { PosterStorage } from "@/server/storage/poster-storage";
import { OCR_STALE_CLAIM_MS, processPosterOcr } from "@/services/poster-ocr";
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

const OCR_TEXT = ["ROBOTICS SHOWCASE", "Date: 20 December 2026", "Venue: Main Auditorium"].join(
  "\n",
);

function createMemoryStorage(): PosterStorage {
  const files = new Map<string, Buffer>();

  return {
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
}

function successfulEngine(): OcrEngine {
  return async () => ({
    text: OCR_TEXT,
    words: [{ text: "ROBOTICS", confidence: 92 }],
    confidence: 90,
  });
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
  const storage = createMemoryStorage();
  const poster = await uploadEventPoster(
    actor,
    { eventId: event.id, bytes: validPng(), altText: "Robotics poster" },
    storage,
  );

  return { college, actor, storage, poster };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("authenticated operation rate limits", () => {
  it("throws a retryable 429 after the per-user budget is exhausted", async () => {
    const policy = { namespace: "test-enforce-user", limit: 1, windowSeconds: 60 };
    const userId = "11111111-1111-4111-8111-111111111111";

    await expect(enforceRateLimit(policy, userId)).resolves.toMatchObject({ allowed: true });

    await expect(enforceRateLimit(policy, userId)).rejects.toBeInstanceOf(RateLimitedError);

    try {
      await enforceRateLimit(policy, userId);
      throw new Error("Expected the third request to be limited.");
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitedError);
      expect((error as RateLimitedError).retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("fails closed when the limiter query throws", async () => {
    const spy = vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("connection lost"));

    try {
      const result = await consumeRateLimit(
        { namespace: "test-fail-closed", limit: 5, windowSeconds: 60 },
        "user-under-test",
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSeconds).toBe(60);
    } finally {
      spy.mockRestore();
    }
  });

  it("sets Retry-After on rate-limited HTTP responses", () => {
    const response = errorResponse(new RateLimitedError(42));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});

describe("sensitive export auditing", () => {
  it("records the actor, tenant, scope, and format without personal data", async () => {
    const college = await createCollege();
    const user = await createUser({ collegeId: college.id, role: "CLUB_ADMIN" });
    const actor = await actorForUser(user.id);

    await recordExportAudit(actor, {
      kind: "club-attendance",
      scope: "22222222-2222-4222-8222-222222222222",
      format: "csv",
      rowCount: 3,
    });

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "EXPORT_DOWNLOADED" },
    });

    expect(audit.actorUserId).toBe(user.id);
    expect(audit.collegeId).toBe(college.id);
    expect(audit.entityType).toBe("Export");
    expect(audit.entityId).toBe("club-attendance:22222222-2222-4222-8222-222222222222");
    expect(audit.metadata).toMatchObject({
      kind: "club-attendance",
      format: "csv",
      rowCount: 3,
    });

    const serialized = JSON.stringify(audit.metadata);
    expect(serialized).not.toContain("student");
    expect(serialized).not.toContain("roll");
  });
});

describe("OCR failure containment", () => {
  it("enforces a cooldown after a failed run and allows a retry after it expires", async () => {
    const { actor, storage, poster } = await createOcrFixture();

    const failed = await processPosterOcr(
      actor,
      { posterId: poster.id },
      {
        engine: async () => {
          throw new Error("worker exploded");
        },
        storage,
      },
    );

    expect(failed.status).toBe("FAILED");

    await expect(
      processPosterOcr(actor, { posterId: poster.id }, { engine: successfulEngine(), storage }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });

    await prisma.eventPoster.update({
      where: { id: poster.id },
      data: { ocrCompletedAt: new Date(Date.now() - 61_000) },
    });

    const retried = await processPosterOcr(
      actor,
      { posterId: poster.id },
      { engine: successfulEngine(), storage },
    );

    expect(retried.status).toBe("COMPLETED");
    expect(retried.fields.length).toBeGreaterThan(0);
  });

  it("recovers a stale PROCESSING claim instead of leaving OCR blocked forever", async () => {
    const { actor, storage, poster } = await createOcrFixture();
    const staleAt = new Date(Date.now() - OCR_STALE_CLAIM_MS - 5_000);

    await prisma.eventPoster.update({
      where: { id: poster.id },
      data: {
        ocrStatus: "PROCESSING",
        ocrStartedAt: staleAt,
        ocrCompletedAt: null,
        ocrError: null,
      },
    });

    const recovered = await processPosterOcr(
      actor,
      { posterId: poster.id },
      { engine: successfulEngine(), storage },
    );

    expect(recovered.status).toBe("COMPLETED");
    const stored = await prisma.eventPoster.findUniqueOrThrow({ where: { id: poster.id } });
    expect(stored.ocrStatus).toBe("COMPLETED");
    expect(stored.ocrStartedAt?.getTime()).toBeGreaterThan(staleAt.getTime());
  });

  it("does not steal a fresh in-flight OCR claim", async () => {
    const { actor, storage, poster } = await createOcrFixture();
    const currentAt = new Date();

    await prisma.eventPoster.update({
      where: { id: poster.id },
      data: {
        ocrStatus: "PROCESSING",
        ocrStartedAt: currentAt,
        ocrCompletedAt: null,
        ocrError: null,
      },
    });

    let engineCalled = false;
    const result = await processPosterOcr(
      actor,
      { posterId: poster.id },
      {
        engine: async (...args) => {
          engineCalled = true;
          return successfulEngine()(...args);
        },
        storage,
      },
    );

    expect(result.status).toBe("PROCESSING");
    expect(engineCalled).toBe(false);
    const stored = await prisma.eventPoster.findUniqueOrThrow({ where: { id: poster.id } });
    expect(stored.ocrStatus).toBe("PROCESSING");
    expect(stored.ocrStartedAt?.getTime()).toBe(currentAt.getTime());
  });

  it("records a timeout as a safe failure instead of waiting forever", async () => {
    const { actor, storage, poster } = await createOcrFixture();

    const result = await processPosterOcr(
      actor,
      { posterId: poster.id },
      {
        engine: () => new Promise(() => undefined),
        storage,
        ocrTimeoutMs: 25,
      },
    );

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("took too long");

    const stored = await prisma.eventPoster.findUniqueOrThrow({ where: { id: poster.id } });
    expect(stored.ocrStatus).toBe("FAILED");
    expect(stored.ocrError).toContain("took too long");
  });
});

describe("health endpoint", () => {
  it("reports database readiness without exposing configuration", async () => {
    const response = await healthGET();
    const body = (await response.json()) as {
      status: string;
      checks: { database: { status: string; latencyMs?: number } };
      uptimeSeconds: number;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(body)).not.toContain("postgresql://");
  });
});

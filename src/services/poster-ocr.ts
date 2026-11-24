import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type {
  PosterOcrExtractionStatus,
  PosterOcrFieldName,
  PosterOcrReviewStatus,
  PosterOcrStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { runInTransaction } from "@/server/db/transactions";
import {
  ActorNotAuthorizedError,
  DomainError,
  InvalidInputError,
  InvalidTransitionError,
  RateLimitedError,
} from "@/server/errors";
import { validatePosterImage } from "@/server/posters/image";
import { acquireOcrSlot } from "@/server/ocr/concurrency";
import { OCR_DEFAULT_TIMEOUT_MS } from "@/server/ocr/constants";
import { extractPosterFields, type OcrSuggestion, type OcrWord } from "@/server/ocr/extract";
import type { OcrEngine } from "@/server/ocr/tesseract-engine";
import { getPosterStorage, type PosterStorage } from "@/server/storage/poster-storage";
import { zonedDateString, zonedDateTimeToUtc, zonedTimeString } from "@/lib/timezone";
import {
  assertActorActive,
  assertClubManagerFor,
  type AuthenticatedActor,
} from "@/services/authorization";
import { updateEventInTransaction } from "@/services/events";
import { parseServiceInput, uuidSchema } from "@/services/validation";

export const OCR_FIELD_ORDER: PosterOcrFieldName[] = [
  "TITLE",
  "SUMMARY",
  "DESCRIPTION",
  "START_DATE",
  "START_TIME",
  "END_DATE",
  "END_TIME",
  "REGISTRATION_DEADLINE_DATE",
  "REGISTRATION_DEADLINE_TIME",
  "VENUE",
  "VENUE_ADDRESS",
  "ORGANIZER",
  "CONTACT",
  "CATEGORY",
];

const ocrFieldSchema = z.enum([
  "TITLE",
  "SUMMARY",
  "DESCRIPTION",
  "START_DATE",
  "START_TIME",
  "END_DATE",
  "END_TIME",
  "REGISTRATION_DEADLINE_DATE",
  "REGISTRATION_DEADLINE_TIME",
  "VENUE",
  "VENUE_ADDRESS",
  "ORGANIZER",
  "CONTACT",
  "CATEGORY",
]);

const processOcrSchema = z.object({
  posterId: uuidSchema,
});

const applyOcrSchema = z.object({
  posterId: uuidSchema,
  eventId: uuidSchema,
  decisions: z
    .array(
      z.object({
        field: ocrFieldSchema,
        decision: z.enum(["ACCEPT", "REJECT", "PENDING"]),
        value: z.string().max(10_000).nullable().optional(),
      }),
    )
    .min(1)
    .max(20),
});

const editableStatuses = new Set(["DRAFT", "REJECTED"]);

/**
 * A failed poster may be retried, but not immediately. The cooldown prevents a
 * tight retry loop from turning one bad image into unbounded Tesseract work.
 */
export const OCR_FAILURE_RETRY_COOLDOWN_MS = 60_000;

/**
 * The engine applies its own deadline. This backstop covers injected engines
 * and any future adapter that ignores the option, calibrated below the 15s
 * serverless execution ceiling.
 */
const OCR_BACKSTOP_TIMEOUT_MS = OCR_DEFAULT_TIMEOUT_MS + 2_000;

/**
 * A claim older than this cannot still be running under the normal worker
 * deadline and backstop. It is therefore safe to recover after a process crash
 * or an interrupted failure write.
 */
export const OCR_STALE_CLAIM_MS = OCR_BACKSTOP_TIMEOUT_MS + 60_000;

export type PosterOcrReview = {
  poster: {
    id: string;
    status: PosterOcrStatus;
    error: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    reviewedAt: Date | null;
  };
  fields: Array<{
    id: string;
    field: PosterOcrFieldName;
    value: string | null;
    confidence: number | null;
    evidence: string | null;
    extractionStatus: PosterOcrExtractionStatus;
    reviewStatus: PosterOcrReviewStatus;
    requiresReview: boolean;
    reviewedValue: string | null;
    reviewedAt: Date | null;
  }>;
};

type PosterForManagement = Prisma.EventPosterGetPayload<{
  include: {
    event: {
      include: {
        club: true;
        college: { select: { timezone: true } };
        categories: { select: { categoryId: true } };
      };
    };
  };
}>;

function sortFields<T extends { field: PosterOcrFieldName }>(fields: T[]): T[] {
  return [...fields].sort(
    (left, right) => OCR_FIELD_ORDER.indexOf(left.field) - OCR_FIELD_ORDER.indexOf(right.field),
  );
}

function assertEditableEvent(actor: AuthenticatedActor, poster: PosterForManagement): void {
  assertActorActive(actor);

  if (poster.event.deletedAt) {
    throw new DomainError("NOT_FOUND", "The requested event does not exist.", 404);
  }

  if (poster.event.collegeId !== poster.collegeId) {
    throw new ActorNotAuthorizedError("The poster does not belong to the event's college.");
  }

  if (poster.event.club.status !== "ACTIVE") {
    throw new ActorNotAuthorizedError("This club is not active.");
  }

  assertClubManagerFor(actor, poster.event.clubId, poster.event.collegeId);

  if (!editableStatuses.has(poster.event.status)) {
    throw new InvalidTransitionError(
      "Poster OCR review is available only for draft or rejected events.",
    );
  }

  if (!poster.isPrimary) {
    throw new InvalidInputError("Only the primary poster can be processed for OCR.");
  }
}

async function loadPosterForManagement(
  actor: AuthenticatedActor,
  posterId: string,
  eventId?: string,
): Promise<PosterForManagement> {
  const poster = await prisma.eventPoster.findUnique({
    where: { id: posterId },
    include: {
      event: {
        include: {
          club: true,
          college: { select: { timezone: true } },
          categories: { select: { categoryId: true } },
        },
      },
    },
  });

  if (!poster) {
    throw new DomainError("NOT_FOUND", "The requested poster does not exist.", 404);
  }

  if (eventId && poster.eventId !== eventId) {
    throw new DomainError("NOT_FOUND", "The requested poster does not belong to this event.", 404);
  }

  assertEditableEvent(actor, poster);
  return poster;
}

async function loadReview(posterId: string): Promise<PosterOcrReview> {
  const poster = await prisma.eventPoster.findUniqueOrThrow({
    where: { id: posterId },
    include: { ocrFields: true },
  });

  return {
    poster: {
      id: poster.id,
      status: poster.ocrStatus,
      error: poster.ocrError,
      startedAt: poster.ocrStartedAt,
      completedAt: poster.ocrCompletedAt,
      reviewedAt: poster.ocrReviewedAt,
    },
    fields: sortFields(
      poster.ocrFields.map((field) => ({
        id: field.id,
        field: field.field,
        value: field.value,
        confidence: field.confidence,
        evidence: field.evidence,
        extractionStatus: field.extractionStatus,
        reviewStatus: field.reviewStatus,
        requiresReview: field.requiresReview,
        reviewedValue: field.reviewedValue,
        reviewedAt: field.reviewedAt,
      })),
    ),
  };
}

function safeOcrError(error: unknown): string {
  if (error instanceof InvalidInputError) {
    return error.message.slice(0, 500);
  }

  if (error instanceof DomainError && error.code === "OCR_TIMEOUT") {
    return error.message.slice(0, 500);
  }

  return "The poster could not be processed. Try again or enter the event details manually.";
}

async function runOcrWithDeadline(
  engine: OcrEngine,
  bytes: Buffer,
  timeoutMs = OCR_BACKSTOP_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<{ text: string; words: OcrWord[]; confidence: number | null }> {
  const engineTimeoutMs = Math.min(OCR_DEFAULT_TIMEOUT_MS, timeoutMs);
  const controller = new AbortController();

  if (signal?.aborted) {
    controller.abort();
  } else if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const work = engine(bytes, { timeoutMs: engineTimeoutMs, signal: controller.signal });
  // If the backstop wins, the engine may still reject later. Attach a handler
  // so that late failure is not reported as an unhandled rejection.
  work.catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new DomainError(
          "OCR_TIMEOUT",
          "Poster analysis took too long. Try a smaller or clearer image.",
          504,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function markOcrFailed(
  actor: AuthenticatedActor,
  poster: { id: string; collegeId: string; eventId: string },
  error: unknown,
): Promise<string> {
  const message = safeOcrError(error);

  try {
    await runInTransaction(prisma, async (tx) => {
      await tx.posterOcrField.deleteMany({
        where: { posterId: poster.id, collegeId: poster.collegeId },
      });
      await tx.eventPoster.update({
        where: { id: poster.id },
        data: {
          ocrStatus: "FAILED",
          ocrError: message,
          ocrCompletedAt: new Date(),
        },
      });
      await writeAuditLog(tx, {
        collegeId: poster.collegeId,
        actorUserId: actor.id,
        action: "EVENT_UPDATED",
        entityType: "Event",
        entityId: poster.eventId,
        metadata: { source: "poster_ocr", posterId: poster.id, ocrStatus: "FAILED" },
      });
    });
  } catch (failure) {
    console.error("Could not record poster OCR failure", failure);
  }

  return message;
}

export async function getPosterOcrReviewForEvent(
  actor: AuthenticatedActor,
  eventId: string,
): Promise<PosterOcrReview | null> {
  assertActorActive(actor);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      club: true,
      posters: {
        where: { isPrimary: true },
        take: 1,
        include: { ocrFields: true },
      },
    },
  });

  if (!event || event.deletedAt) {
    throw new DomainError("NOT_FOUND", "The requested event does not exist.", 404);
  }

  if (event.club.status !== "ACTIVE") {
    throw new ActorNotAuthorizedError("This club is not active.");
  }

  assertClubManagerFor(actor, event.clubId, event.collegeId);

  if (!editableStatuses.has(event.status)) {
    return null;
  }

  const poster = event.posters[0];
  if (!poster) {
    return null;
  }

  return {
    poster: {
      id: poster.id,
      status: poster.ocrStatus,
      error: poster.ocrError,
      startedAt: poster.ocrStartedAt,
      completedAt: poster.ocrCompletedAt,
      reviewedAt: poster.ocrReviewedAt,
    },
    fields: sortFields(
      poster.ocrFields.map((field) => ({
        id: field.id,
        field: field.field,
        value: field.value,
        confidence: field.confidence,
        evidence: field.evidence,
        extractionStatus: field.extractionStatus,
        reviewStatus: field.reviewStatus,
        requiresReview: field.requiresReview,
        reviewedValue: field.reviewedValue,
        reviewedAt: field.reviewedAt,
      })),
    ),
  };
}

export async function processPosterOcr(
  actor: AuthenticatedActor,
  input: unknown,
  dependencies: {
    engine?: OcrEngine;
    storage?: PosterStorage;
    ocrTimeoutMs?: number;
    abortSignal?: AbortSignal;
  } = {},
): Promise<{
  status: PosterOcrStatus;
  error: string | null;
  fields: OcrSuggestion[];
}> {
  const data = parseServiceInput(processOcrSchema, input);
  let poster = await loadPosterForManagement(actor, data.posterId);

  if (poster.ocrStatus === "COMPLETED") {
    const review = await loadReview(poster.id);
    return {
      status: "COMPLETED",
      error: null,
      fields: review.fields.map((field) => ({
        field: field.field,
        value: field.value,
        confidence: field.confidence,
        evidence: field.evidence,
        extractionStatus: field.extractionStatus,
        requiresReview: field.requiresReview,
      })),
    };
  }

  if (poster.ocrStatus === "PROCESSING" || poster.ocrStatus === "PENDING") {
    const claimAgeMs = poster.ocrStartedAt
      ? Date.now() - poster.ocrStartedAt.getTime()
      : Number.POSITIVE_INFINITY;
    const stale = poster.ocrStatus === "PENDING" || claimAgeMs >= OCR_STALE_CLAIM_MS;

    if (!stale) {
      return { status: poster.ocrStatus, error: null, fields: [] };
    }

    // The worker is bounded by the engine deadline and service backstop. A
    // claim older than OCR_STALE_CLAIM_MS cannot still be running normally, so
    // recover it after a crash or an interrupted failure-state write.
    const recovered = await prisma.eventPoster.updateMany({
      where: {
        id: poster.id,
        collegeId: poster.collegeId,
        ocrStatus: poster.ocrStatus,
        ocrStartedAt: poster.ocrStartedAt,
      },
      data: {
        ocrStatus: "FAILED",
        ocrError:
          "Poster analysis was interrupted before it finished. Try again or enter the event details manually.",
        ocrCompletedAt: poster.ocrStartedAt ?? new Date(0),
      },
    });

    if (recovered.count !== 1) {
      const current = await prisma.eventPoster.findUniqueOrThrow({
        where: { id: poster.id },
        select: { ocrStatus: true, ocrError: true },
      });
      return { status: current.ocrStatus, error: current.ocrError, fields: [] };
    }

    poster = {
      ...poster,
      ocrStatus: "FAILED",
      ocrError:
        "Poster analysis was interrupted before it finished. Try again or enter the event details manually.",
      ocrCompletedAt: poster.ocrStartedAt ?? new Date(0),
    };
  }

  if (poster.ocrStatus === "FAILED" && poster.ocrCompletedAt) {
    const retryAt = poster.ocrCompletedAt.getTime() + OCR_FAILURE_RETRY_COOLDOWN_MS;

    if (Date.now() < retryAt) {
      throw new RateLimitedError(
        Math.max(1, Math.ceil((retryAt - Date.now()) / 1_000)),
        "Poster analysis recently failed. Wait a moment before trying again.",
      );
    }
  }

  const releaseOcrSlot = await acquireOcrSlot();
  let claimed: { count: number };

  try {
    claimed = await prisma.eventPoster.updateMany({
      where: {
        id: poster.id,
        collegeId: poster.collegeId,
        ocrStatus: { in: ["NOT_REQUESTED", "FAILED"] },
      },
      data: {
        ocrStatus: "PROCESSING",
        ocrStartedAt: new Date(),
        ocrCompletedAt: null,
        ocrError: null,
      },
    });
  } catch (error) {
    releaseOcrSlot();
    throw error;
  }

  if (claimed.count !== 1) {
    releaseOcrSlot();
    const current = await prisma.eventPoster.findUniqueOrThrow({
      where: { id: poster.id },
      select: { ocrStatus: true, ocrError: true },
    });
    return { status: current.ocrStatus, error: current.ocrError, fields: [] };
  }

  try {
    const storage = dependencies.storage ?? getPosterStorage();
    const bytes = await storage.get(poster.storageKey);

    if (!bytes) {
      throw new InvalidInputError("The poster file is no longer available.");
    }

    validatePosterImage(bytes);

    // Load Tesseract only when OCR is actually requested. Importing the engine
    // eagerly pulls the worker, WASM, and language data into every build worker
    // and server route that imports the dashboard actions.
    const engine =
      dependencies.engine ?? (await import("@/server/ocr/tesseract-engine")).recognizePosterImage;
    const recognized = await runOcrWithDeadline(
      engine,
      bytes,
      dependencies.ocrTimeoutMs,
      dependencies.abortSignal,
    );

    if (recognized.text.replace(/\s/g, "").length < 3) {
      throw new InvalidInputError("No readable text was found in this poster.");
    }

    const categories = await prisma.category.findMany({
      where: { collegeId: poster.collegeId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    });

    const extraction = extractPosterFields({
      text: recognized.text,
      words: recognized.words,
      categories,
      clubName: poster.event.club.name,
    });
    const now = new Date();

    await runInTransaction(prisma, async (tx) => {
      await tx.posterOcrField.deleteMany({
        where: { posterId: poster.id, collegeId: poster.collegeId },
      });
      await tx.posterOcrField.createMany({
        data: extraction.suggestions.map((suggestion) => ({
          collegeId: poster.collegeId,
          posterId: poster.id,
          field: suggestion.field,
          value: suggestion.value,
          confidence: suggestion.confidence,
          evidence: suggestion.evidence,
          extractionStatus: suggestion.extractionStatus,
          requiresReview: suggestion.requiresReview,
        })),
      });
      await tx.eventPoster.update({
        where: { id: poster.id },
        data: {
          ocrStatus: "COMPLETED",
          ocrText: extraction.text.slice(0, 50_000),
          ocrError: null,
          ocrCompletedAt: now,
        },
      });
      await writeAuditLog(tx, {
        collegeId: poster.collegeId,
        actorUserId: actor.id,
        action: "EVENT_UPDATED",
        entityType: "Event",
        entityId: poster.eventId,
        metadata: {
          source: "poster_ocr",
          posterId: poster.id,
          ocrStatus: "COMPLETED",
          fieldCount: extraction.suggestions.length,
        },
      });
    });

    return {
      status: "COMPLETED",
      error: null,
      fields: extraction.suggestions,
    };
  } catch (error) {
    const message = await markOcrFailed(actor, poster, error);
    return { status: "FAILED", error: message, fields: [] };
  } finally {
    releaseOcrSlot();
  }
}

function acceptedValue(
  decision: { decision: "ACCEPT" | "REJECT" | "PENDING"; value?: string | null },
  field: { value: string | null },
  label: string,
): string {
  if (decision.decision !== "ACCEPT") {
    return "";
  }

  const value = (decision.value !== undefined ? decision.value : field.value)?.trim() ?? "";
  if (!value) {
    throw new InvalidInputError(`The accepted ${label} suggestion has no value.`);
  }
  return value;
}

function nullableText(
  decision: { decision: "ACCEPT" | "REJECT" | "PENDING"; value?: string | null },
  field: { value: string | null },
): string | null {
  const value = (decision.value !== undefined ? decision.value : field.value)?.trim() ?? "";
  return value || null;
}

export async function applyPosterOcrReview(actor: AuthenticatedActor, input: unknown) {
  const data = parseServiceInput(applyOcrSchema, input);
  const poster = await loadPosterForManagement(actor, data.posterId, data.eventId);
  const storedFields = await prisma.posterOcrField.findMany({
    where: { posterId: poster.id, collegeId: poster.collegeId },
  });
  const fieldMap = new Map(storedFields.map((field) => [field.field, field]));
  const decisionMap = new Map(data.decisions.map((decision) => [decision.field, decision]));

  for (const decision of data.decisions) {
    if (!fieldMap.has(decision.field)) {
      throw new InvalidInputError("One or more OCR suggestions no longer exist.");
    }
  }

  const accepted = (field: PosterOcrFieldName) => decisionMap.get(field)?.decision === "ACCEPT";
  const event = poster.event;
  const timezone = event.college.timezone;
  const patch: Record<string, unknown> = {};
  const referenceOnlyFields: PosterOcrFieldName[] = [];

  if (accepted("TITLE")) {
    patch.title = acceptedValue(decisionMap.get("TITLE")!, fieldMap.get("TITLE")!, "title");
  }
  if (accepted("SUMMARY")) {
    patch.summary = nullableText(decisionMap.get("SUMMARY")!, fieldMap.get("SUMMARY")!);
  }
  if (accepted("DESCRIPTION")) {
    patch.description = nullableText(decisionMap.get("DESCRIPTION")!, fieldMap.get("DESCRIPTION")!);
  }
  if (accepted("VENUE")) {
    patch.venueName = acceptedValue(decisionMap.get("VENUE")!, fieldMap.get("VENUE")!, "venue");
  }
  if (accepted("VENUE_ADDRESS")) {
    patch.venueAddress = nullableText(
      decisionMap.get("VENUE_ADDRESS")!,
      fieldMap.get("VENUE_ADDRESS")!,
    );
  }

  const startDateAccepted = accepted("START_DATE");
  const startTimeAccepted = accepted("START_TIME");
  if (startDateAccepted || startTimeAccepted) {
    const startDate = startDateAccepted
      ? acceptedValue(decisionMap.get("START_DATE")!, fieldMap.get("START_DATE")!, "start date")
      : zonedDateString(event.startsAt, timezone);
    const startTime = startTimeAccepted
      ? acceptedValue(decisionMap.get("START_TIME")!, fieldMap.get("START_TIME")!, "start time")
      : zonedTimeString(event.startsAt, timezone);
    const startsAt = zonedDateTimeToUtc(startDate, startTime, timezone);
    if (!startsAt) {
      throw new InvalidInputError("The accepted start date or time is not valid.");
    }
    patch.startsAt = startsAt;
  }

  const endDateAccepted = accepted("END_DATE");
  const endTimeAccepted = accepted("END_TIME");
  if (endDateAccepted || endTimeAccepted) {
    const endDate = endDateAccepted
      ? acceptedValue(decisionMap.get("END_DATE")!, fieldMap.get("END_DATE")!, "end date")
      : zonedDateString(event.endsAt, timezone);
    const endTime = endTimeAccepted
      ? acceptedValue(decisionMap.get("END_TIME")!, fieldMap.get("END_TIME")!, "end time")
      : zonedTimeString(event.endsAt, timezone);
    const endsAt = zonedDateTimeToUtc(endDate, endTime, timezone);
    if (!endsAt) {
      throw new InvalidInputError("The accepted end date or time is not valid.");
    }
    patch.endsAt = endsAt;
  }

  const deadlineDateAccepted = accepted("REGISTRATION_DEADLINE_DATE");
  const deadlineTimeAccepted = accepted("REGISTRATION_DEADLINE_TIME");
  if (deadlineDateAccepted || deadlineTimeAccepted) {
    const existingDeadline = event.registrationDeadline;
    if (!existingDeadline && (!deadlineDateAccepted || !deadlineTimeAccepted)) {
      throw new InvalidInputError(
        "Accept both a registration deadline date and time, or enter the deadline manually.",
      );
    }
    const deadlineDate = deadlineDateAccepted
      ? acceptedValue(
          decisionMap.get("REGISTRATION_DEADLINE_DATE")!,
          fieldMap.get("REGISTRATION_DEADLINE_DATE")!,
          "registration deadline date",
        )
      : zonedDateString(existingDeadline!, timezone);
    const deadlineTime = deadlineTimeAccepted
      ? acceptedValue(
          decisionMap.get("REGISTRATION_DEADLINE_TIME")!,
          fieldMap.get("REGISTRATION_DEADLINE_TIME")!,
          "registration deadline time",
        )
      : zonedTimeString(existingDeadline!, timezone);
    const deadline = zonedDateTimeToUtc(deadlineDate, deadlineTime, timezone);
    if (!deadline) {
      throw new InvalidInputError("The accepted registration deadline is not valid.");
    }
    patch.registrationDeadline = deadline;
  }

  if (accepted("ORGANIZER")) {
    referenceOnlyFields.push("ORGANIZER");
  }
  if (accepted("CONTACT")) {
    referenceOnlyFields.push("CONTACT");
  }

  if (accepted("CATEGORY")) {
    const categoryId = acceptedValue(
      decisionMap.get("CATEGORY")!,
      fieldMap.get("CATEGORY")!,
      "category",
    );
    const category = await prisma.category.findFirst({
      where: { id: categoryId, collegeId: poster.collegeId, isActive: true },
      select: { id: true },
    });
    if (!category) {
      throw new InvalidInputError("The accepted category is not available for this college.");
    }
    patch.categoryIds = Array.from(
      new Set([...event.categories.map((categoryLink) => categoryLink.categoryId), category.id]),
    );
  }

  const acceptedFields = data.decisions
    .filter((decision) => decision.decision === "ACCEPT")
    .map((decision) => decision.field);
  const rejectedFields = data.decisions
    .filter((decision) => decision.decision === "REJECT")
    .map((decision) => decision.field);
  const pendingFields = data.decisions
    .filter((decision) => decision.decision === "PENDING")
    .map((decision) => decision.field);
  const now = new Date();

  const result = await runInTransaction(prisma, async (tx) => {
    if (Object.keys(patch).length) {
      await updateEventInTransaction(
        tx,
        actor,
        { eventId: event.id, ...patch },
        {
          skipAudit: true,
          auditMetadata: {
            source: "poster_ocr_review",
            posterId: poster.id,
            acceptedFields,
          },
        },
      );
    }

    for (const decision of data.decisions) {
      const field = fieldMap.get(decision.field)!;
      const reviewedValue =
        decision.decision === "ACCEPT"
          ? decision.value !== undefined
            ? decision.value
            : field.value
          : null;
      await tx.posterOcrField.update({
        where: { id: field.id },
        data: {
          reviewStatus:
            decision.decision === "ACCEPT"
              ? "ACCEPTED"
              : decision.decision === "REJECT"
                ? "REJECTED"
                : "PENDING",
          reviewedValue,
          reviewedAt: decision.decision === "PENDING" ? null : now,
        },
      });
    }

    await tx.eventPoster.update({
      where: { id: poster.id },
      data: { ocrReviewedAt: now },
    });

    await writeAuditLog(tx, {
      collegeId: poster.collegeId,
      actorUserId: actor.id,
      action: "EVENT_UPDATED",
      entityType: "Event",
      entityId: event.id,
      metadata: {
        source: "poster_ocr_review",
        posterId: poster.id,
        acceptedFields,
        rejectedFields,
        pendingFields,
        referenceOnlyFields,
        appliedEventFields: Object.keys(patch),
      },
    });

    return tx.posterOcrField.findMany({
      where: { posterId: poster.id, collegeId: poster.collegeId },
    });
  });

  return {
    fields: sortFields(
      result.map((field) => ({
        id: field.id,
        field: field.field,
        value: field.value,
        confidence: field.confidence,
        evidence: field.evidence,
        extractionStatus: field.extractionStatus,
        reviewStatus: field.reviewStatus,
        requiresReview: field.requiresReview,
        reviewedValue: field.reviewedValue,
        reviewedAt: field.reviewedAt,
      })),
    ),
  };
}

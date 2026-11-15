import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { DuplicateStatus } from "@/generated/prisma/enums";
import { zonedDateString } from "@/lib/timezone";
import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { runInTransaction } from "@/server/db/transactions";
import { DomainError, InvalidTransitionError, TenantIsolationError } from "@/server/errors";
import {
  assertActorActive,
  assertCollegeAdmin,
  type AuthenticatedActor,
} from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";

/**
 * Advisory duplicate detection.
 *
 * Detection is deterministic and local: normalized title similarity, same-day
 * scheduling in the college timezone, venue similarity, and same-club ownership.
 * A match is stored for human review only. Nothing in this module changes an
 * event's status, merges records, deletes data, or auto-rejects a submission.
 */

export const DUPLICATE_THRESHOLD = 0.62;

export const DUPLICATE_WEIGHTS = {
  title: 0.55,
  date: 0.25,
  venue: 0.15,
  club: 0.05,
} as const;

const DUPLICATE_CANDIDATE_STATUSES = ["PENDING_APPROVAL", "PUBLISHED", "COMPLETED"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

export type DuplicateEventSummary = {
  id: string;
  title: string;
  slug: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  venueName: string;
  isOnline: boolean;
  club: { id: string; name: string };
};

export type DuplicateReview = {
  id: string;
  status: DuplicateStatus;
  confidence: number;
  reasons: string[];
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedBy: { id: string; name: string } | null;
  primaryEvent: DuplicateEventSummary;
  candidateEvent: DuplicateEventSummary;
};

export type DuplicateScore = {
  confidence: number;
  titleScore: number;
  dateScore: number;
  venueScore: number;
  clubScore: number;
  isDuplicate: boolean;
  reasons: string[];
};

type DuplicateEventInput = {
  id: string;
  collegeId: string;
  clubId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  venueName: string;
  isOnline: boolean;
  createdAt: Date;
  status: string;
  club: { name: string };
};

type DuplicateReviewRow = Prisma.EventDuplicateGetPayload<{
  include: {
    primaryEvent: {
      select: {
        id: true;
        collegeId: true;
        title: true;
        slug: true;
        status: true;
        startsAt: true;
        endsAt: true;
        venueName: true;
        isOnline: true;
        club: { select: { id: true; name: true } };
      };
    };
    candidateEvent: {
      select: {
        id: true;
        collegeId: true;
        title: true;
        slug: true;
        status: true;
        startsAt: true;
        endsAt: true;
        venueName: true;
        isOnline: true;
        club: { select: { id: true; name: true } };
      };
    };
    reviewedBy: { select: { id: true; name: true } };
  };
}>;

const reviewSchema = z.object({
  duplicateId: uuidSchema,
  decision: z.enum(["CONFIRM", "DISMISS"]),
});

const duplicateEventSelect = {
  id: true,
  collegeId: true,
  title: true,
  slug: true,
  status: true,
  startsAt: true,
  endsAt: true,
  venueName: true,
  isOnline: true,
  club: { select: { id: true, name: true } },
} satisfies Prisma.EventSelect;

const duplicateReviewInclude = {
  primaryEvent: { select: duplicateEventSelect },
  candidateEvent: { select: duplicateEventSelect },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.EventDuplicateInclude;

function normalizeDuplicateText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(value: string): string[] {
  return normalizeDuplicateText(value)
    .split(" ")
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

function jaccardSimilarity(left: string[], right: string[]): number {
  if (!left.length || !right.length) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  return intersection / (leftSet.size + rightSet.size - intersection);
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (!left.length) {
    return right.length;
  }
  if (!right.length) {
    return left.length;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }

    previous = current;
  }

  return previous[right.length];
}

function levenshteinRatio(left: string, right: string): number {
  const longest = Math.max(left.length, right.length);
  if (!longest) {
    return 1;
  }

  return 1 - levenshteinDistance(left, right) / longest;
}

function titleSimilarity(left: string, right: string): number {
  const leftTokens = meaningfulTokens(left);
  const rightTokens = meaningfulTokens(right);
  const jaccard = jaccardSimilarity(leftTokens, rightTokens);
  const editRatio = levenshteinRatio(leftTokens.join(" "), rightTokens.join(" "));

  return 0.6 * jaccard + 0.4 * editRatio;
}

function venueSimilarity(
  left: { venueName: string; isOnline: boolean },
  right: {
    venueName: string;
    isOnline: boolean;
  },
): number {
  if (left.isOnline && right.isOnline) {
    return 1;
  }

  if (left.isOnline !== right.isOnline) {
    return 0;
  }

  const leftTokens = meaningfulTokens(left.venueName);
  const rightTokens = meaningfulTokens(right.venueName);
  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }

  return jaccardSimilarity(leftTokens, rightTokens);
}

function localDate(date: Date, timezone: string): string {
  return zonedDateString(date, timezone);
}

function duplicateReasons(input: {
  primary: DuplicateEventInput;
  candidate: DuplicateEventInput;
  timezone: string;
  titleScore: number;
  dateScore: number;
  venueScore: number;
  clubScore: number;
}): string[] {
  const reasons: string[] = [];

  if (input.titleScore > 0) {
    reasons.push(
      `Titles are ${Math.round(input.titleScore * 100)}% similar after normalizing case and punctuation.`,
    );
  }

  if (input.dateScore === 1) {
    reasons.push(
      `Both events start on ${localDate(input.primary.startsAt, input.timezone)} in the college timezone.`,
    );
  }

  if (input.venueScore > 0) {
    reasons.push(`Venue names are ${Math.round(input.venueScore * 100)}% similar.`);
  }

  if (input.clubScore === 1) {
    reasons.push(`Both events are organized by ${input.primary.club.name}.`);
  }

  return reasons;
}

export function scoreDuplicatePair(
  primary: DuplicateEventInput,
  candidate: DuplicateEventInput,
  timezone: string,
): DuplicateScore {
  const titleScore = titleSimilarity(primary.title, candidate.title);
  const dateScore =
    localDate(primary.startsAt, timezone) === localDate(candidate.startsAt, timezone) ? 1 : 0;
  const venueScore = venueSimilarity(primary, candidate);
  const clubScore = primary.clubId === candidate.clubId ? 1 : 0;
  const confidence =
    titleScore * DUPLICATE_WEIGHTS.title +
    dateScore * DUPLICATE_WEIGHTS.date +
    venueScore * DUPLICATE_WEIGHTS.venue +
    clubScore * DUPLICATE_WEIGHTS.club;
  const guard = titleScore >= 0.72 || (dateScore === 1 && venueScore >= 0.7 && titleScore >= 0.5);
  const isDuplicate = dateScore === 1 && confidence >= DUPLICATE_THRESHOLD && guard;

  return {
    confidence: Math.round(confidence * 10_000) / 10_000,
    titleScore: Math.round(titleScore * 10_000) / 10_000,
    dateScore,
    venueScore: Math.round(venueScore * 10_000) / 10_000,
    clubScore,
    isDuplicate,
    reasons: duplicateReasons({
      primary,
      candidate,
      timezone,
      titleScore,
      dateScore,
      venueScore,
      clubScore,
    }),
  };
}

function toDuplicateReview(row: DuplicateReviewRow): DuplicateReview {
  return {
    id: row.id,
    status: row.status,
    confidence: Number(row.confidence),
    reasons: row.reasons,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    reviewedBy: row.reviewedBy,
    primaryEvent: row.primaryEvent,
    candidateEvent: row.candidateEvent,
  };
}

/**
 * Recomputes pending duplicate suggestions for one event. Confirmed and
 * dismissed reviews are intentionally preserved.
 */
export async function refreshEventDuplicates(eventId: string): Promise<{
  created: number;
  removed: number;
}> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      collegeId: true,
      clubId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      isOnline: true,
      createdAt: true,
      status: true,
      deletedAt: true,
      club: { select: { name: true } },
      college: { select: { timezone: true } },
    },
  });

  if (
    !event ||
    event.deletedAt ||
    !DUPLICATE_CANDIDATE_STATUSES.includes(
      event.status as (typeof DUPLICATE_CANDIDATE_STATUSES)[number],
    )
  ) {
    return { created: 0, removed: 0 };
  }

  const windowStart = new Date(event.startsAt.getTime() - DAY_MS);
  const windowEnd = new Date(event.startsAt.getTime() + DAY_MS);
  const candidates = await prisma.event.findMany({
    where: {
      id: { not: event.id },
      collegeId: event.collegeId,
      deletedAt: null,
      status: { in: [...DUPLICATE_CANDIDATE_STATUSES] },
      startsAt: { gte: windowStart, lte: windowEnd },
      club: { deletedAt: null },
    },
    select: {
      id: true,
      collegeId: true,
      clubId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      isOnline: true,
      createdAt: true,
      status: true,
      club: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
  });

  const matches = candidates
    .map((candidate) => ({
      candidate,
      score: scoreDuplicatePair(event, candidate, event.college.timezone),
    }))
    .filter((entry) => entry.score.isDuplicate);

  return runInTransaction(prisma, async (tx) => {
    const removed = await tx.eventDuplicate.deleteMany({
      where: {
        collegeId: event.collegeId,
        status: "PENDING",
        OR: [{ primaryEventId: event.id }, { candidateEventId: event.id }],
      },
    });

    if (!matches.length) {
      return { created: 0, removed: removed.count };
    }

    const data = matches.map(({ candidate, score }) => {
      const [primary, duplicateCandidate] =
        event.createdAt.getTime() <= candidate.createdAt.getTime()
          ? [event, candidate]
          : [candidate, event];

      return {
        collegeId: event.collegeId,
        primaryEventId: primary.id,
        candidateEventId: duplicateCandidate.id,
        status: "PENDING" as const,
        confidence: score.confidence,
        reasons: score.reasons,
      };
    });

    const created = await tx.eventDuplicate.createMany({
      data,
      skipDuplicates: true,
    });

    return { created: created.count, removed: removed.count };
  });
}

export async function clearPendingDuplicatesForEvent(eventId: string): Promise<number> {
  const result = await prisma.eventDuplicate.deleteMany({
    where: {
      status: "PENDING",
      OR: [{ primaryEventId: eventId }, { candidateEventId: eventId }],
    },
  });

  return result.count;
}

export async function getPendingDuplicateReviewsForCollege(
  actor: AuthenticatedActor,
): Promise<DuplicateReview[]> {
  assertActorActive(actor);

  if (!actor.collegeId) {
    return [];
  }

  assertCollegeAdmin(actor, actor.collegeId);

  const rows = await prisma.eventDuplicate.findMany({
    where: {
      collegeId: actor.collegeId,
      status: "PENDING",
      primaryEvent: { deletedAt: null },
      candidateEvent: { deletedAt: null },
    },
    include: duplicateReviewInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
  });

  return rows.map(toDuplicateReview);
}

export async function getDuplicateReviewsForEvent(
  actor: AuthenticatedActor,
  eventId: string,
): Promise<DuplicateReview[]> {
  assertActorActive(actor);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { collegeId: true, deletedAt: true },
  });

  if (!event || event.deletedAt) {
    throw new DomainError("NOT_FOUND", "The requested event does not exist.", 404);
  }

  assertCollegeAdmin(actor, event.collegeId);

  const rows = await prisma.eventDuplicate.findMany({
    where: {
      collegeId: event.collegeId,
      OR: [{ primaryEventId: eventId }, { candidateEventId: eventId }],
    },
    include: duplicateReviewInclude,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return rows.map(toDuplicateReview);
}

export async function reviewDuplicate(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(reviewSchema, input);

  return runInTransaction(prisma, async (tx) => {
    const duplicate = await tx.eventDuplicate.findUnique({
      where: { id: data.duplicateId },
      include: duplicateReviewInclude,
    });

    if (!duplicate) {
      throw new DomainError("NOT_FOUND", "The requested duplicate review does not exist.", 404);
    }

    if (
      duplicate.primaryEvent.id === duplicate.candidateEvent.id ||
      duplicate.primaryEvent.collegeId !== duplicate.collegeId ||
      duplicate.candidateEvent.collegeId !== duplicate.collegeId
    ) {
      throw new TenantIsolationError();
    }

    assertCollegeAdmin(actor, duplicate.collegeId);

    if (duplicate.status !== "PENDING") {
      throw new InvalidTransitionError("This duplicate suggestion has already been reviewed.");
    }

    const status: DuplicateStatus = data.decision === "CONFIRM" ? "CONFIRMED" : "DISMISSED";
    const now = new Date();
    const result = await tx.eventDuplicate.updateMany({
      where: {
        id: duplicate.id,
        collegeId: duplicate.collegeId,
        status: "PENDING",
      },
      data: {
        status,
        reviewedById: actor.id,
        reviewedAt: now,
      },
    });

    if (result.count !== 1) {
      throw new DomainError("CONFLICT", "The duplicate review changed while it was saved.", 409);
    }

    await writeAuditLog(tx, {
      collegeId: duplicate.collegeId,
      actorUserId: actor.id,
      action: status === "CONFIRMED" ? "DUPLICATE_CONFIRMED" : "DUPLICATE_DISMISSED",
      entityType: "EventDuplicate",
      entityId: duplicate.id,
      metadata: {
        primaryEventId: duplicate.primaryEventId,
        candidateEventId: duplicate.candidateEventId,
        confidence: Number(duplicate.confidence),
        reasons: duplicate.reasons,
        decision: status,
        automaticEventChange: false,
      },
    });

    return tx.eventDuplicate.findUniqueOrThrow({
      where: { id: duplicate.id },
      include: duplicateReviewInclude,
    });
  });
}

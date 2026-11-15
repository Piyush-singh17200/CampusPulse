import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { eventListSelect } from "@/server/dashboards/event-select";
import { assertStudent, type AuthenticatedActor } from "@/services/authorization";

const recommendationEventSelect = {
  ...eventListSelect,
  interests: {
    select: {
      interest: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
} satisfies Prisma.EventSelect;

type RecommendationEvent = Prisma.EventGetPayload<{ select: typeof recommendationEventSelect }>;

export type EventRecommendation = {
  event: RecommendationEvent;
  score: number;
  explanations: string[];
  signals: {
    interestMatch: string[];
    categoryMatch: string[];
    daysUntilStart: number;
    registrationClosesInDays: number | null;
    popularity: number;
  };
};

export type RecommendationResult = {
  recommendations: EventRecommendation[];
  reason: string | null;
};

const WEIGHTS = {
  interest: 0.4,
  category: 0.25,
  timing: 0.2,
  popularity: 0.15,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(later: Date, earlier: Date): number {
  return Math.max(0, (later.getTime() - earlier.getTime()) / DAY_MS);
}

function redistributeWeights(available: {
  interest: boolean;
  category: boolean;
  timing: boolean;
  popularity: boolean;
}): Record<keyof typeof WEIGHTS, number> {
  const total = Object.entries(WEIGHTS).reduce(
    (sum, [key, weight]) => sum + (available[key as keyof typeof WEIGHTS] ? weight : 0),
    0,
  );

  if (total === 0) {
    return { interest: 0, category: 0, timing: 1, popularity: 0 };
  }

  return {
    interest: available.interest ? WEIGHTS.interest / total : 0,
    category: available.category ? WEIGHTS.category / total : 0,
    timing: available.timing ? WEIGHTS.timing / total : 0,
    popularity: available.popularity ? WEIGHTS.popularity / total : 0,
  };
}

function fallbackExplanation(event: RecommendationEvent, now: Date): string {
  if (event.publishedAt && daysBetween(now, event.publishedAt) <= 14) {
    return `Recently published by ${event.club.name}.`;
  }

  return `Open for registration at ${event.club.name}.`;
}

/**
 * Deterministic, database-backed recommendations.
 *
 * Signals:
 * - Explicit student interests matched against explicit event-interest tags.
 * - Category affinity learned from the student's registrations and saved events.
 * - Timing (soonness).
 * - Relative confirmed/attended registration count.
 *
 * A signal is only used when it exists. Unavailable weights are redistributed,
 * and every explanation names a real signal. No external model is called.
 */
export async function getStudentRecommendations(
  actor: AuthenticatedActor,
  options: { limit?: number } = {},
): Promise<RecommendationResult> {
  assertStudent(actor);

  if (!actor.collegeId) {
    return { recommendations: [], reason: "Your account is not linked to a college yet." };
  }

  const limit = Math.min(Math.max(options.limit ?? 4, 1), 12);
  const now = new Date();
  const profile = await prisma.studentProfile.findUnique({
    where: { userId_collegeId: { userId: actor.id, collegeId: actor.collegeId } },
    select: {
      id: true,
      interests: { select: { interestId: true } },
    },
  });

  if (!profile) {
    return {
      recommendations: [],
      reason: "Complete your student profile and interests to get personalized recommendations.",
    };
  }

  const [registeredRows, savedRows] = await Promise.all([
    prisma.eventRegistration.findMany({
      where: { collegeId: actor.collegeId, studentProfileId: profile.id },
      select: { eventId: true },
    }),
    prisma.savedEvent.findMany({
      where: { collegeId: actor.collegeId, studentProfileId: profile.id },
      select: { eventId: true },
    }),
  ]);

  const excludedEventIds = Array.from(
    new Set([...registeredRows.map((row) => row.eventId), ...savedRows.map((row) => row.eventId)]),
  );

  const candidates = await prisma.event.findMany({
    where: {
      collegeId: actor.collegeId,
      status: "PUBLISHED",
      deletedAt: null,
      startsAt: { gt: now },
      endsAt: { gt: now },
      club: { status: "ACTIVE", deletedAt: null },
      id: excludedEventIds.length ? { notIn: excludedEventIds } : undefined,
      AND: [
        { OR: [{ registrationOpensAt: null }, { registrationOpensAt: { lte: now } }] },
        { OR: [{ registrationDeadline: null }, { registrationDeadline: { gte: now } }] },
      ],
    },
    select: recommendationEventSelect,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 80,
  });

  if (!candidates.length) {
    return {
      recommendations: [],
      reason: "There are no upcoming events open for registration at your college right now.",
    };
  }

  const candidateIds = candidates.map((event) => event.id);
  const [popularityRows, registeredCategoryRows, savedCategoryRows] = await Promise.all([
    prisma.eventRegistration.groupBy({
      by: ["eventId"],
      where: {
        collegeId: actor.collegeId,
        eventId: { in: candidateIds },
        status: { in: ["CONFIRMED", "ATTENDED"] },
      },
      _count: { _all: true },
    }),
    prisma.eventCategory.groupBy({
      by: ["categoryId"],
      where: {
        event: {
          collegeId: actor.collegeId,
          registrations: {
            some: {
              studentProfileId: profile.id,
              status: { in: ["CONFIRMED", "ATTENDED", "NO_SHOW"] },
            },
          },
        },
      },
      _count: { _all: true },
    }),
    prisma.eventCategory.groupBy({
      by: ["categoryId"],
      where: {
        event: {
          collegeId: actor.collegeId,
          savedByStudents: { some: { studentProfileId: profile.id } },
        },
      },
      _count: { _all: true },
    }),
  ]);

  const popularityByEvent = new Map(popularityRows.map((row) => [row.eventId, row._count._all]));
  const categoryAffinity = new Map<string, number>();
  for (const row of registeredCategoryRows) {
    categoryAffinity.set(
      row.categoryId,
      (categoryAffinity.get(row.categoryId) ?? 0) + row._count._all * 2,
    );
  }
  for (const row of savedCategoryRows) {
    categoryAffinity.set(
      row.categoryId,
      (categoryAffinity.get(row.categoryId) ?? 0) + row._count._all,
    );
  }

  const eligible = candidates.filter((event) => {
    if (event.capacity === null) {
      return true;
    }
    return (popularityByEvent.get(event.id) ?? 0) < event.capacity;
  });

  if (!eligible.length) {
    return {
      recommendations: [],
      reason: "Every upcoming event that matches your college is already full or closed.",
    };
  }

  const studentInterestIds = new Set(profile.interests.map((interest) => interest.interestId));
  const maxAffinity = Math.max(0, ...categoryAffinity.values());
  const maxPopularity = Math.max(
    0,
    ...eligible.map((event) => popularityByEvent.get(event.id) ?? 0),
  );

  const interestAvailable =
    studentInterestIds.size > 0 && eligible.some((event) => event.interests.length > 0);
  const categoryAvailable = categoryAffinity.size > 0 && maxAffinity > 0;
  const popularityAvailable = maxPopularity >= 2;
  const weights = redistributeWeights({
    interest: interestAvailable,
    category: categoryAvailable,
    timing: true,
    popularity: popularityAvailable,
  });

  const scored = eligible.map((event) => {
    const matchedInterests = event.interests
      .map((link) => link.interest)
      .filter((interest) => studentInterestIds.has(interest.id));
    const interestScore = interestAvailable ? (matchedInterests.length ? 1 : 0) : 0;

    const matchedCategories = event.categories
      .map((link) => link.category)
      .filter((category) => (categoryAffinity.get(category.id) ?? 0) > 0);
    const bestAffinity = Math.max(
      0,
      ...matchedCategories.map((category) => categoryAffinity.get(category.id) ?? 0),
    );
    const categoryScore = categoryAvailable && maxAffinity > 0 ? bestAffinity / maxAffinity : 0;

    const daysUntilStart = daysBetween(event.startsAt, now);
    const timingScore = Math.max(0, Math.min(1, 1 - daysUntilStart / 30));

    const popularity = popularityByEvent.get(event.id) ?? 0;
    const popularityScore = popularityAvailable ? popularity / maxPopularity : 0;

    const score =
      interestScore * weights.interest +
      categoryScore * weights.category +
      timingScore * weights.timing +
      popularityScore * weights.popularity;

    const explanations: string[] = [];
    if (matchedInterests.length) {
      explanations.push(
        `Matches your interest in ${matchedInterests
          .slice(0, 2)
          .map((interest) => interest.name)
          .join(" and ")}.`,
      );
    }
    if (matchedCategories.length) {
      explanations.push(`Matches ${matchedCategories[0].name}, a category you have explored.`);
    }

    const registrationClosesInDays =
      event.registrationDeadline && event.registrationDeadline >= now
        ? daysBetween(event.registrationDeadline, now)
        : null;
    if (registrationClosesInDays !== null && registrationClosesInDays <= 3) {
      const days = Math.max(1, Math.ceil(registrationClosesInDays));
      explanations.push(`Registration closes in ${days} day${days === 1 ? "" : "s"}.`);
    }
    if (daysUntilStart <= 7) {
      explanations.push("Happening in the next 7 days.");
    }
    if (popularity >= 3 && popularity >= Math.max(3, maxPopularity * 0.5)) {
      explanations.push("Popular among students at your college.");
    }

    if (!explanations.length) {
      explanations.push(fallbackExplanation(event, now));
    }

    return {
      event,
      score: Math.round(score * 1000) / 1000,
      explanations: explanations.slice(0, 3),
      signals: {
        interestMatch: matchedInterests.map((interest) => interest.name),
        categoryMatch: matchedCategories.map((category) => category.name),
        daysUntilStart,
        registrationClosesInDays,
        popularity,
      },
    };
  });

  scored.sort(
    (left, right) =>
      right.score - left.score ||
      left.event.startsAt.getTime() - right.event.startsAt.getTime() ||
      left.event.id.localeCompare(right.event.id),
  );

  return {
    recommendations: scored.slice(0, limit),
    reason: null,
  };
}

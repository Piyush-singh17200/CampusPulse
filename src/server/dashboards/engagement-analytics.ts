import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { EventStatus, RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";
import {
  assertClubDashboard,
  assertCollegeDashboard,
  assertPlatformDashboard,
  managedClubIds,
} from "@/server/dashboards/access";
import { ActorNotAuthorizedError, TenantIsolationError } from "@/server/errors";
import { uuidSchema } from "@/services/validation";
import { assertActorActive, isSuperAdmin } from "@/services/authorization";

export type AnalyticsFilters = {
  from?: string;
  to?: string;
  eventId?: string;
  category?: string;
  clubId?: string;
  status?: string;
};

type NormalizedFilters = {
  from: string;
  to: string;
  eventId: string;
  category: string;
  clubId: string;
  status: string;
  fromDate: Date;
  toDate: Date;
};

const EVENT_STATUSES = new Set([
  "DRAFT",
  "PENDING_APPROVAL",
  "PUBLISHED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
]);

function parseDate(value: string | undefined, endOfDay: boolean): Date | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (endOfDay) {
    parsed.setUTCHours(23, 59, 59, 999);
  }

  return parsed;
}

function dateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function normalizeAnalyticsFilters(filters: AnalyticsFilters = {}): NormalizedFilters {
  const now = new Date();
  const defaultTo = new Date(now);
  defaultTo.setUTCHours(23, 59, 59, 999);
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setUTCMonth(defaultFrom.getUTCMonth() - 6);
  defaultFrom.setUTCHours(0, 0, 0, 0);

  const fromDate = parseDate(filters.from, false) ?? defaultFrom;
  const toDate = parseDate(filters.to, true) ?? defaultTo;
  const orderedFrom = fromDate <= toDate ? fromDate : toDate;
  const orderedTo = fromDate <= toDate ? toDate : fromDate;
  const eventId =
    filters.eventId && uuidSchema.safeParse(filters.eventId).success ? filters.eventId : "";
  const clubId =
    filters.clubId && uuidSchema.safeParse(filters.clubId).success ? filters.clubId : "";
  const status = filters.status && EVENT_STATUSES.has(filters.status) ? filters.status : "";

  return {
    from: dateInput(orderedFrom),
    to: dateInput(orderedTo),
    eventId,
    category: filters.category?.trim() ?? "",
    clubId,
    status,
    fromDate: orderedFrom,
    toDate: orderedTo,
  };
}

export function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

function emptyStatusCounts() {
  return {
    CONFIRMED: 0,
    CANCELLED: 0,
    ATTENDED: 0,
    NO_SHOW: 0,
  } satisfies Record<RegistrationStatus, number>;
}

type EventRow = {
  id: string;
  title: string;
  startsAt: Date;
  status: EventStatus;
  clubId: string;
  capacity: number | null;
  club: { id: string; name: string };
  categories: { category: { id: string; name: string; slug: string } }[];
};

type MonthCount = { month: string; count: number };

type EventMetrics = {
  events: EventRow[];
  registrationsByEvent: Map<string, Record<RegistrationStatus, number>>;
  feedbackByEvent: Map<string, { count: number; total: number }>;
  registrationMonths: MonthCount[];
  attendanceMonths: MonthCount[];
  timezone: string;
};

type MonthCountRow = { month: string; count: bigint | number };

/**
 * Monthly registration/attendance trends are aggregated in PostgreSQL rather
 * than by loading every registration into Node. This keeps analytics complete
 * for large events and colleges without a silent row cap.
 */
async function loadMonthlyTrend(
  collegeId: string,
  eventIds: string[],
  timezone: string,
  column: "registeredAt" | "checkedInAt",
): Promise<MonthCount[]> {
  if (!eventIds.length) {
    return [];
  }

  const rows =
    column === "registeredAt"
      ? await prisma.$queryRaw<MonthCountRow[]>`
          SELECT to_char(
            date_trunc('month', ("registeredAt" AT TIME ZONE ${timezone})),
            'YYYY-MM'
          ) AS month,
          count(*) AS count
          FROM "event_registrations"
          WHERE "collegeId" = ${collegeId}::uuid
            AND "eventId" = ANY(${eventIds}::uuid[])
          GROUP BY 1
          ORDER BY 1
        `
      : await prisma.$queryRaw<MonthCountRow[]>`
          SELECT to_char(
            date_trunc('month', ("checkedInAt" AT TIME ZONE ${timezone})),
            'YYYY-MM'
          ) AS month,
          count(*) AS count
          FROM "event_registrations"
          WHERE "collegeId" = ${collegeId}::uuid
            AND "eventId" = ANY(${eventIds}::uuid[])
            AND "status" = 'ATTENDED'
            AND "checkedInAt" IS NOT NULL
          GROUP BY 1
          ORDER BY 1
        `;

  return rows.map((row) => ({ month: row.month, count: Number(row.count) }));
}

async function loadEventMetrics(
  collegeId: string,
  filters: NormalizedFilters,
): Promise<EventMetrics> {
  const where: Prisma.EventWhereInput = {
    collegeId,
    deletedAt: null,
    // Selecting a specific event makes that event the scope, even when it falls
    // outside the dashboard's default date window.
    ...(filters.eventId ? {} : { startsAt: { gte: filters.fromDate, lte: filters.toDate } }),
    ...(filters.clubId ? { clubId: filters.clubId } : {}),
    ...(filters.eventId ? { id: filters.eventId } : {}),
    ...(filters.status ? { status: filters.status as EventStatus } : {}),
    ...(filters.category ? { categories: { some: { category: { slug: filters.category } } } } : {}),
  };

  const [events, college] = await Promise.all([
    prisma.event.findMany({
      where,
      select: {
        id: true,
        title: true,
        startsAt: true,
        status: true,
        clubId: true,
        capacity: true,
        club: { select: { id: true, name: true } },
        categories: {
          select: { category: { select: { id: true, name: true, slug: true } } },
        },
      },
      orderBy: { startsAt: "desc" },
    }),
    prisma.college.findFirst({
      where: { id: collegeId, deletedAt: null },
      select: { timezone: true },
    }),
  ]);

  if (filters.eventId && events.length === 0) {
    throw new TenantIsolationError();
  }

  const eventIds = events.map((event) => event.id);
  const registrationsByEvent = new Map<string, Record<RegistrationStatus, number>>();
  for (const eventId of eventIds) {
    registrationsByEvent.set(eventId, emptyStatusCounts());
  }
  const feedbackByEvent = new Map<string, { count: number; total: number }>();
  const timezone = college?.timezone ?? "Asia/Kolkata";
  let registrationMonths: MonthCount[] = [];
  let attendanceMonths: MonthCount[] = [];

  if (eventIds.length) {
    const registrationCounts = await prisma.eventRegistration.groupBy({
      by: ["eventId", "status"],
      where: { collegeId, eventId: { in: eventIds } },
      _count: { _all: true },
    });
    for (const row of registrationCounts) {
      const counts = registrationsByEvent.get(row.eventId) ?? emptyStatusCounts();
      counts[row.status] += row._count._all;
      registrationsByEvent.set(row.eventId, counts);
    }

    const feedbackCounts = await prisma.eventFeedback.groupBy({
      by: ["eventId", "rating"],
      where: { collegeId, eventId: { in: eventIds }, moderationStatus: "VISIBLE" },
      _count: { _all: true },
    });
    for (const row of feedbackCounts) {
      const current = feedbackByEvent.get(row.eventId) ?? { count: 0, total: 0 };
      current.count += row._count._all;
      current.total += row.rating * row._count._all;
      feedbackByEvent.set(row.eventId, current);
    }

    [registrationMonths, attendanceMonths] = await Promise.all([
      loadMonthlyTrend(collegeId, eventIds, timezone, "registeredAt"),
      loadMonthlyTrend(collegeId, eventIds, timezone, "checkedInAt"),
    ]);
  }

  return {
    events,
    registrationsByEvent,
    feedbackByEvent,
    registrationMonths,
    attendanceMonths,
    timezone,
  };
}

function monthFormatter(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: timezone,
  });
}

function monthSeries(rows: { date: Date }[], timezone: string): { month: string; count: number }[] {
  const formatter = monthFormatter(timezone);
  const months = new Map<string, number>();
  for (const row of rows) {
    const key = formatter.format(row.date);
    months.set(key, (months.get(key) ?? 0) + 1);
  }

  return [...months.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, count]) => ({ month, count }));
}

function eventBreakdown(metrics: EventMetrics) {
  return metrics.events.map((event) => {
    const counts = metrics.registrationsByEvent.get(event.id) ?? emptyStatusCounts();
    const eligible = counts.CONFIRMED + counts.ATTENDED + counts.NO_SHOW;
    const feedback = metrics.feedbackByEvent.get(event.id);
    return {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      status: event.status,
      clubName: event.club.name,
      totalRegistrations: counts.CONFIRMED + counts.CANCELLED + counts.ATTENDED + counts.NO_SHOW,
      activeRegistrations: counts.CONFIRMED + counts.ATTENDED,
      cancelledRegistrations: counts.CANCELLED,
      attended: counts.ATTENDED,
      noShow: counts.NO_SHOW,
      eligible,
      attendanceRate: percentage(counts.ATTENDED, eligible),
      averageRating: feedback && feedback.count > 0 ? feedback.total / feedback.count : null,
      feedbackCount: feedback?.count ?? 0,
    };
  });
}

function summarize(metrics: EventMetrics) {
  const breakdown = eventBreakdown(metrics);
  const statusCounts = metrics.events.reduce<Record<string, number>>((accumulator, event) => {
    accumulator[event.status] = (accumulator[event.status] ?? 0) + 1;
    return accumulator;
  }, {});
  const totalRegistrations = breakdown.reduce((sum, event) => sum + event.totalRegistrations, 0);
  const activeRegistrations = breakdown.reduce((sum, event) => sum + event.activeRegistrations, 0);
  const cancelledRegistrations = breakdown.reduce(
    (sum, event) => sum + event.cancelledRegistrations,
    0,
  );
  const attended = breakdown.reduce((sum, event) => sum + event.attended, 0);
  const noShow = breakdown.reduce((sum, event) => sum + event.noShow, 0);
  const eligible = breakdown.reduce((sum, event) => sum + event.eligible, 0);
  const feedbackCount = breakdown.reduce((sum, event) => sum + event.feedbackCount, 0);
  const feedbackTotal = [...metrics.feedbackByEvent.values()].reduce(
    (sum, feedback) => sum + feedback.total,
    0,
  );
  const published = statusCounts.PUBLISHED ?? 0;
  const completed = statusCounts.COMPLETED ?? 0;

  return {
    breakdown,
    statusCounts,
    totalEvents: metrics.events.length,
    publishedEvents: published,
    pendingApprovals: statusCounts.PENDING_APPROVAL ?? 0,
    completedEvents: completed,
    totalRegistrations,
    activeRegistrations,
    cancelledRegistrations,
    attendedRegistrations: attended,
    noShowRegistrations: noShow,
    eligibleRegistrations: eligible,
    attendanceRate: percentage(attended, eligible),
    eventCompletionRate: percentage(completed, published + completed),
    averageRating: feedbackCount > 0 ? feedbackTotal / feedbackCount : null,
    feedbackResponseCount: feedbackCount,
  };
}

function filterOptionsForEvents(events: EventRow[], timezone: string) {
  return {
    eventMonths: monthSeries(
      events.map((event) => ({ date: event.startsAt })),
      timezone,
    ),
    categoryBreakdown: (() => {
      // Group by ID, not display name. Two categories may share a name, and the
      // UI must not merge their counts.
      const categories = new Map<string, { name: string; count: number }>();
      for (const event of events) {
        for (const item of event.categories) {
          const current = categories.get(item.category.id) ?? {
            name: item.category.name,
            count: 0,
          };
          current.count += 1;
          categories.set(item.category.id, current);
        }
      }
      return [...categories.values()].sort((left, right) => right.count - left.count);
    })(),
    clubActivity: (() => {
      // Clubs are separate entities even when names collide. Use the club ID as
      // the grouping key and retain the display name for the label.
      const clubs = new Map<string, { name: string; count: number }>();
      for (const event of events) {
        const current = clubs.get(event.club.id) ?? { name: event.club.name, count: 0 };
        current.count += 1;
        clubs.set(event.club.id, current);
      }
      return [...clubs.values()].sort((left, right) => right.count - left.count).slice(0, 10);
    })(),
  };
}

function emptyClubAnalytics(filters: NormalizedFilters) {
  return {
    totalEvents: 0,
    publishedEvents: 0,
    pendingApprovals: 0,
    completedEvents: 0,
    totalRegistrations: 0,
    activeRegistrations: 0,
    cancelledRegistrations: 0,
    attendedRegistrations: 0,
    noShowRegistrations: 0,
    eligibleRegistrations: 0,
    attendanceRate: null as number | null,
    eventCompletionRate: null as number | null,
    averageRating: null as number | null,
    feedbackResponseCount: 0,
    eventStatusCounts: [] as { status: EventStatus; count: number }[],
    eventBreakdown: [] as ReturnType<typeof eventBreakdown>,
    eventMonths: [] as { month: string; count: number }[],
    registrationMonths: [] as { month: string; count: number }[],
    attendanceMonths: [] as { month: string; count: number }[],
    categoryBreakdown: [] as { name: string; count: number }[],
    feedbackDistribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 })),
    mostAttendedEvents: [] as ReturnType<typeof eventBreakdown>,
    lowAttendanceEvents: [] as ReturnType<typeof eventBreakdown>,
    filters,
  };
}

export async function getClubEngagementAnalytics(
  actor: Parameters<typeof assertClubDashboard>[0],
  requestedClubId?: string,
  filters: AnalyticsFilters = {},
) {
  assertClubDashboard(actor);
  const collegeId = actor.collegeId!;
  const ids = managedClubIds(actor);
  const [clubs, categories] = await Promise.all([
    prisma.club.findMany({
      where: { collegeId, id: { in: ids }, deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { collegeId, isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const club = requestedClubId ? clubs.find((item) => item.id === requestedClubId) : clubs[0];
  if (requestedClubId && !club) {
    throw new TenantIsolationError();
  }

  const normalized = normalizeAnalyticsFilters({
    ...filters,
    clubId: club?.id ?? filters.clubId,
  });

  if (!club) {
    return {
      clubs,
      club: null,
      categories,
      eventOptions: [] as {
        id: string;
        title: string;
        startsAt: Date;
        status: EventStatus;
        clubId: string;
      }[],
      ...emptyClubAnalytics(normalized),
    };
  }

  const [initialEventOptions, metrics] = await Promise.all([
    prisma.event.findMany({
      where: { collegeId, clubId: club.id, deletedAt: null },
      select: { id: true, title: true, startsAt: true, status: true, clubId: true },
      orderBy: { startsAt: "desc" },
      take: 100,
    }),
    loadEventMetrics(collegeId, normalized),
  ]);
  let eventOptions = initialEventOptions;

  // An event selected from an old link may fall outside the latest 100 options.
  // Add it explicitly so the filter reflects the selected scope instead of
  // silently dropping or rejecting it.
  if (normalized.eventId && !eventOptions.some((event) => event.id === normalized.eventId)) {
    const selectedEvent = await prisma.event.findFirst({
      where: {
        id: normalized.eventId,
        collegeId,
        clubId: club.id,
        deletedAt: null,
      },
      select: { id: true, title: true, startsAt: true, status: true, clubId: true },
    });

    if (!selectedEvent) {
      throw new TenantIsolationError();
    }

    eventOptions = [selectedEvent, ...eventOptions];
  }

  const summary = summarize(metrics);
  const breakdown = summary.breakdown;
  const feedbackRows = await prisma.eventFeedback.groupBy({
    by: ["rating"],
    where: {
      collegeId,
      eventId: { in: metrics.events.map((event) => event.id) },
      moderationStatus: "VISIBLE",
    },
    _count: { _all: true },
    orderBy: { rating: "asc" },
  });

  return {
    clubs,
    club,
    categories,
    eventOptions,
    ...emptyClubAnalytics(normalized),
    ...summary,
    eventStatusCounts: Object.entries(summary.statusCounts).map(([status, count]) => ({
      status: status as EventStatus,
      count,
    })),
    eventBreakdown: breakdown,
    ...filterOptionsForEvents(metrics.events, metrics.timezone),
    registrationMonths: metrics.registrationMonths,
    attendanceMonths: metrics.attendanceMonths,
    feedbackDistribution: [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: feedbackRows.find((row) => row.rating === rating)?._count._all ?? 0,
    })),
    mostAttendedEvents: [...breakdown]
      .sort((left, right) => right.attended - left.attended)
      .slice(0, 5),
    lowAttendanceEvents: breakdown
      .filter(
        (event) => event.eligible > 0 && event.attendanceRate !== null && event.attendanceRate < 50,
      )
      .sort((left, right) => (left.attendanceRate ?? 0) - (right.attendanceRate ?? 0))
      .slice(0, 5),
  };
}

function emptyCollegeAnalytics(filters: NormalizedFilters) {
  return {
    totalEvents: 0,
    publishedEvents: 0,
    pendingApprovals: 0,
    completedEvents: 0,
    totalRegistrations: 0,
    activeRegistrations: 0,
    cancelledRegistrations: 0,
    attendedRegistrations: 0,
    noShowRegistrations: 0,
    eligibleRegistrations: 0,
    attendanceRate: null as number | null,
    eventCompletionRate: null as number | null,
    averageRating: null as number | null,
    feedbackResponseCount: 0,
    eventStatusCounts: [] as { status: EventStatus; count: number }[],
    eventBreakdown: [] as ReturnType<typeof eventBreakdown>,
    eventMonths: [] as { month: string; count: number }[],
    registrationMonths: [] as { month: string; count: number }[],
    attendanceMonths: [] as { month: string; count: number }[],
    categoryBreakdown: [] as { name: string; count: number }[],
    clubActivity: [] as { name: string; count: number }[],
    feedbackDistribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 })),
    mostAttendedEvents: [] as ReturnType<typeof eventBreakdown>,
    lowAttendanceEvents: [] as ReturnType<typeof eventBreakdown>,
    filters,
  };
}

export async function getCollegeEngagementAnalytics(
  actor: Parameters<typeof assertCollegeDashboard>[0],
  filters: AnalyticsFilters = {},
) {
  const collegeId = assertCollegeDashboard(actor);
  const normalized = normalizeAnalyticsFilters(filters);
  const [college, clubs, categories, initialEventOptions] = await Promise.all([
    prisma.college.findFirst({
      where: { id: collegeId, deletedAt: null },
      select: { id: true, name: true, shortName: true, timezone: true },
    }),
    prisma.club.findMany({
      where: { collegeId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { collegeId, isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.event.findMany({
      where: { collegeId, deletedAt: null },
      select: { id: true, title: true, startsAt: true, status: true, clubId: true },
      orderBy: { startsAt: "desc" },
      take: 100,
    }),
  ]);
  let eventOptions = initialEventOptions;

  if (!college) {
    throw new TenantIsolationError();
  }

  if (normalized.clubId && !clubs.some((club) => club.id === normalized.clubId)) {
    throw new TenantIsolationError();
  }

  if (normalized.eventId && !eventOptions.some((event) => event.id === normalized.eventId)) {
    const selectedEvent = await prisma.event.findFirst({
      where: {
        id: normalized.eventId,
        collegeId,
        deletedAt: null,
        ...(normalized.clubId ? { clubId: normalized.clubId } : {}),
      },
      select: { id: true, title: true, startsAt: true, status: true, clubId: true },
    });

    if (!selectedEvent) {
      throw new TenantIsolationError();
    }

    eventOptions = [selectedEvent, ...eventOptions];
  }

  const metrics = await loadEventMetrics(collegeId, normalized);
  const summary = summarize(metrics);
  const feedbackRows = await prisma.eventFeedback.groupBy({
    by: ["rating"],
    where: {
      collegeId,
      eventId: { in: metrics.events.map((event) => event.id) },
      moderationStatus: "VISIBLE",
    },
    _count: { _all: true },
    orderBy: { rating: "asc" },
  });
  const pendingApprovals = await prisma.event.count({
    where: { collegeId, deletedAt: null, status: "PENDING_APPROVAL" },
  });

  return {
    college,
    clubs,
    categories,
    eventOptions,
    ...emptyCollegeAnalytics(normalized),
    ...summary,
    pendingApprovals,
    eventStatusCounts: Object.entries(summary.statusCounts).map(([status, count]) => ({
      status: status as EventStatus,
      count,
    })),
    eventBreakdown: summary.breakdown,
    ...filterOptionsForEvents(metrics.events, metrics.timezone),
    registrationMonths: metrics.registrationMonths,
    attendanceMonths: metrics.attendanceMonths,
    feedbackDistribution: [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: feedbackRows.find((row) => row.rating === rating)?._count._all ?? 0,
    })),
    mostAttendedEvents: [...summary.breakdown]
      .sort((left, right) => right.attended - left.attended)
      .slice(0, 5),
    lowAttendanceEvents: summary.breakdown
      .filter(
        (event) => event.eligible > 0 && event.attendanceRate !== null && event.attendanceRate < 50,
      )
      .sort((left, right) => (left.attendanceRate ?? 0) - (right.attendanceRate ?? 0))
      .slice(0, 5),
  };
}

export async function getPlatformEngagementAnalytics(
  actor: Parameters<typeof assertPlatformDashboard>[0],
  filters: AnalyticsFilters = {},
) {
  assertPlatformDashboard(actor);
  const normalized = normalizeAnalyticsFilters(filters);
  const eventWhere: Prisma.EventWhereInput = {
    deletedAt: null,
    startsAt: { gte: normalized.fromDate, lte: normalized.toDate },
    ...(normalized.eventId ? { id: normalized.eventId } : {}),
    ...(normalized.clubId ? { clubId: normalized.clubId } : {}),
    ...(normalized.status ? { status: normalized.status as EventStatus } : {}),
    ...(normalized.category
      ? { categories: { some: { category: { slug: normalized.category } } } }
      : {}),
  };

  const [
    collegeCount,
    activeUsers,
    eventStatusRows,
    registrationStatusRows,
    feedbackAggregate,
    eventRows,
    registrationRows,
  ] = await Promise.all([
    prisma.college.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.event.groupBy({
      by: ["status"],
      where: eventWhere,
      _count: { _all: true },
    }),
    prisma.eventRegistration.groupBy({
      by: ["status"],
      where: { event: eventWhere },
      _count: { _all: true },
    }),
    prisma.eventFeedback.aggregate({
      where: {
        moderationStatus: "VISIBLE",
        event: eventWhere,
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.event.findMany({
      where: eventWhere,
      select: {
        startsAt: true,
        collegeId: true,
        college: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 5_001,
    }),
    prisma.eventRegistration.findMany({
      where: { event: eventWhere },
      select: { registeredAt: true, checkedInAt: true, status: true },
      orderBy: { registeredAt: "asc" },
      take: 5_001,
    }),
  ]);
  const eventTrendsTruncated = eventRows.length > 5_000;
  const registrationTrendsTruncated = registrationRows.length > 5_000;
  const events = eventTrendsTruncated ? eventRows.slice(0, 5_000) : eventRows;
  const registrations = registrationTrendsTruncated
    ? registrationRows.slice(0, 5_000)
    : registrationRows;

  const statusCounts = Object.fromEntries(
    eventStatusRows.map((row) => [row.status, row._count._all]),
  ) as Partial<Record<EventStatus, number>>;
  const registrationCounts = Object.fromEntries(
    registrationStatusRows.map((row) => [row.status, row._count._all]),
  ) as Partial<Record<RegistrationStatus, number>>;
  const totalEvents = eventStatusRows.reduce((sum, row) => sum + row._count._all, 0);
  const published = statusCounts.PUBLISHED ?? 0;
  const completed = statusCounts.COMPLETED ?? 0;
  const attended = registrationCounts.ATTENDED ?? 0;
  const eligible =
    (registrationCounts.CONFIRMED ?? 0) + attended + (registrationCounts.NO_SHOW ?? 0);
  const registrationTotal = registrationStatusRows.reduce((sum, row) => sum + row._count._all, 0);
  const collegeActivity = new Map<string, { id: string; name: string; count: number }>();
  for (const event of events) {
    const current = collegeActivity.get(event.college.id) ?? {
      id: event.college.id,
      name: event.college.name,
      count: 0,
    };
    current.count += 1;
    collegeActivity.set(event.college.id, current);
  }

  return {
    activeColleges: collegeCount,
    activeUsers,
    totalEvents,
    publishedEvents: published,
    completedEvents: completed,
    totalRegistrations: registrationTotal,
    attendedRegistrations: attended,
    eligibleRegistrations: eligible,
    attendanceRate: percentage(attended, eligible),
    eventCompletionRate: percentage(completed, published + completed),
    averageRating: feedbackAggregate._avg.rating,
    feedbackResponseCount: feedbackAggregate._count._all,
    eventStatusCounts: eventStatusRows.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    registrationStatusCounts: registrationStatusRows.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    eventMonths: monthSeries(
      events.map((event) => ({ date: event.startsAt })),
      "UTC",
    ),
    registrationMonths: monthSeries(
      registrations.map((row) => ({ date: row.registeredAt })),
      "UTC",
    ),
    attendanceMonths: monthSeries(
      registrations
        .filter((row) => row.status === "ATTENDED" && row.checkedInAt)
        .map((row) => ({ date: row.checkedInAt! })),
      "UTC",
    ),
    collegeActivity: [...collegeActivity.values()]
      .sort((left, right) => right.count - left.count)
      .slice(0, 10),
    collegeActivityTruncated: eventTrendsTruncated,
    eventTrendsTruncated,
    registrationTrendsTruncated,
    filters: normalized,
  };
}

export async function getClubAttendanceExport(
  actor: Parameters<typeof assertClubDashboard>[0],
  clubId: string,
  eventId: string,
) {
  assertActorActive(actor);

  if (!uuidSchema.safeParse(clubId).success || !uuidSchema.safeParse(eventId).success) {
    throw new TenantIsolationError();
  }

  if (
    actor.role !== "CLUB_ADMIN" &&
    actor.role !== "COLLEGE_ADMIN" &&
    actor.role !== "SUPER_ADMIN"
  ) {
    throw new ActorNotAuthorizedError();
  }

  const isClubMgr =
    actor.role === "CLUB_ADMIN" &&
    actor.clubMemberships.some(
      (m) =>
        m.clubId === clubId &&
        m.status === "ACTIVE" &&
        (m.role === "PRESIDENT" || m.role === "OFFICER"),
    );
  const isCollegeMgr = actor.role === "COLLEGE_ADMIN";
  const isSuper = isSuperAdmin(actor);

  if (!isClubMgr && !isCollegeMgr && !isSuper) {
    throw new TenantIsolationError();
  }

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      clubId,
      ...(isSuper ? {} : { collegeId: actor.collegeId! }),
      deletedAt: null,
      status: { in: ["PUBLISHED", "COMPLETED"] },
    },
    select: { id: true, title: true, startsAt: true, endsAt: true, collegeId: true },
  });

  if (!event) {
    throw new TenantIsolationError();
  }

  const registrations = await prisma.eventRegistration.findMany({
    where: { eventId, collegeId: event.collegeId },
    select: {
      status: true,
      checkedInAt: true,
      registeredAt: true,
      studentProfile: {
        select: {
          rollNumber: true,
          department: true,
          user: { select: { name: true } },
        },
      },
    },
    orderBy: [{ studentProfile: { user: { name: "asc" } } }, { id: "asc" }],
  });

  return { event, registrations };
}

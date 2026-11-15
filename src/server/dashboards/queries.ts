import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { EventStatus, NotificationType, RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/auth/types";
import {
  assertCollegeDashboard,
  assertClubDashboard,
  assertPlatformDashboard,
  assertStudentDashboard,
  managedClubIds,
} from "@/server/dashboards/access";
import { TenantIsolationError } from "@/server/errors";
import { getStudentRecommendations, type EventRecommendation } from "@/services/recommendations";
import {
  detectScheduleConflicts,
  getScheduleConflictsForEvent,
  type ScheduleConflict,
} from "@/services/schedule-conflicts";
import {
  getDuplicateReviewsForEvent,
  getPendingDuplicateReviewsForCollege,
  type DuplicateReview,
} from "@/services/duplicate-events";

import {
  eventDetailSelect,
  eventListSelect,
  type DashboardEvent,
} from "@/server/dashboards/event-select";

export type { DashboardEvent, DashboardEventDetail } from "@/server/dashboards/event-select";

export type StudentProfileView = Prisma.StudentProfileGetPayload<{
  include: {
    user: { select: { id: true; name: true; email: true; image: true } };
    interests: { include: { interest: true } };
  };
}>;

export type StudentContext = {
  profile: StudentProfileView | null;
  college: {
    id: string;
    name: string;
    shortName: string | null;
    timezone: string;
  } | null;
  allInterests: { id: string; name: string; slug: string }[];
};

const studentProfileInclude = {
  user: { select: { id: true, name: true, email: true, image: true } },
  interests: { include: { interest: true } },
} satisfies Prisma.StudentProfileInclude;

const eventCategories = (event: DashboardEvent) => event.categories.map((item) => item.category);

export async function getStudentContext(actor: AuthenticatedActor): Promise<StudentContext> {
  assertStudentDashboard(actor);

  const [profile, college, allInterests] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { userId_collegeId: { userId: actor.id, collegeId: actor.collegeId! } },
      include: studentProfileInclude,
    }),
    prisma.college.findFirst({
      where: { id: actor.collegeId!, deletedAt: null },
      select: { id: true, name: true, shortName: true, timezone: true },
    }),
    prisma.interest.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return { profile, college, allInterests };
}

async function activeRegistrationCounts(eventIds: string[], collegeId: string) {
  if (!eventIds.length) {
    return new Map<string, number>();
  }

  const rows = await prisma.eventRegistration.groupBy({
    by: ["eventId"],
    where: {
      collegeId,
      eventId: { in: eventIds },
      status: { in: ["CONFIRMED", "ATTENDED"] },
    },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.eventId, row._count._all]));
}

export async function getStudentDashboard(actor: AuthenticatedActor) {
  const { profile, college } = await getStudentContext(actor);

  if (!profile || !college) {
    return {
      profile,
      college,
      upcoming: [] as { event: DashboardEvent; registrationId: string }[],
      recommendations: [] as EventRecommendation[],
      recommendationReason:
        "Complete your student profile and interests to get personalized recommendations.",
      recent: [] as DashboardEvent[],
      saved: [] as DashboardEvent[],
      counts: { registered: 0, upcoming: 0, attended: 0, cancelled: 0, saved: 0 },
      unreadNotifications: 0,
    };
  }

  const now = new Date();

  const [
    upcomingRows,
    recent,
    savedRows,
    registeredCount,
    upcomingCount,
    attendedCount,
    cancelledCount,
    savedCount,
    unreadNotifications,
  ] = await Promise.all([
    prisma.eventRegistration.findMany({
      where: {
        collegeId: college.id,
        studentProfileId: profile.id,
        status: "CONFIRMED",
        event: {
          status: "PUBLISHED",
          deletedAt: null,
          startsAt: { gte: now },
          club: { status: "ACTIVE", deletedAt: null },
        },
      },
      select: {
        id: true,
        event: { select: eventListSelect },
      },
      orderBy: { event: { startsAt: "asc" } },
      take: 4,
    }),
    prisma.event.findMany({
      where: {
        collegeId: college.id,
        status: "PUBLISHED",
        deletedAt: null,
        startsAt: { gte: now },
        club: { status: "ACTIVE", deletedAt: null },
      },
      select: eventListSelect,
      orderBy: [{ publishedAt: "desc" }, { startsAt: "asc" }],
      take: 4,
    }),
    prisma.savedEvent.findMany({
      where: {
        collegeId: college.id,
        studentProfileId: profile.id,
        event: { status: "PUBLISHED", deletedAt: null, startsAt: { gte: now } },
      },
      select: { event: { select: eventListSelect } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.eventRegistration.count({
      where: { collegeId: college.id, studentProfileId: profile.id },
    }),
    prisma.eventRegistration.count({
      where: {
        collegeId: college.id,
        studentProfileId: profile.id,
        status: "CONFIRMED",
        event: { startsAt: { gte: now }, status: "PUBLISHED" },
      },
    }),
    prisma.eventRegistration.count({
      where: { collegeId: college.id, studentProfileId: profile.id, status: "ATTENDED" },
    }),
    prisma.eventRegistration.count({
      where: { collegeId: college.id, studentProfileId: profile.id, status: "CANCELLED" },
    }),
    prisma.savedEvent.count({
      where: { collegeId: college.id, studentProfileId: profile.id },
    }),
    prisma.notification.count({
      where: { collegeId: college.id, userId: actor.id, readAt: null },
    }),
  ]);

  let recommendations: EventRecommendation[] = [];
  let recommendationReason: string | null = null;

  try {
    const result = await getStudentRecommendations(actor, { limit: 4 });
    recommendations = result.recommendations;
    recommendationReason = result.reason;
  } catch (error) {
    console.error("Could not load student recommendations", error);
    recommendationReason =
      "Recommendations are temporarily unavailable. You can still browse all events.";
  }

  return {
    profile,
    college,
    upcoming: upcomingRows.map((row) => ({ event: row.event, registrationId: row.id })),
    recommendations,
    recommendationReason,
    recent,
    saved: savedRows.map((row) => row.event),
    counts: {
      registered: registeredCount,
      upcoming: upcomingCount,
      attended: attendedCount,
      cancelled: cancelledCount,
      saved: savedCount,
    },
    unreadNotifications,
  };
}

export type DiscoveryFilters = {
  q?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export async function discoverEvents(actor: AuthenticatedActor, filters: DiscoveryFilters) {
  const { profile, college } = await getStudentContext(actor);

  if (!college) {
    return {
      events: [] as DashboardEvent[],
      total: 0,
      page: 1,
      pageSize: 9,
      totalPages: 0,
      categories: [] as { id: string; name: string; slug: string }[],
      savedEventIds: new Set<string>(),
      registeredEventIds: new Set<string>(),
      filters: { q: "", category: "", dateFrom: "", dateTo: "" },
    };
  }

  const q = filters.q?.trim() ?? "";
  const category = filters.category?.trim() ?? "";
  const dateFrom = filters.dateFrom?.trim() ?? "";
  const dateTo = filters.dateTo?.trim() ?? "";
  const pageSize = Math.min(Math.max(filters.pageSize ?? 9, 1), 48);
  const page = Math.max(filters.page ?? 1, 1);
  const now = new Date();

  const where: Prisma.EventWhereInput = {
    collegeId: college.id,
    status: "PUBLISHED",
    deletedAt: null,
    club: { status: "ACTIVE", deletedAt: null },
    startsAt: { gte: now },
  };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { club: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (category) {
    where.categories = {
      some: { category: { slug: category, collegeId: college.id } },
    };
  }

  const startsAt = { ...(where.startsAt as object) } as Prisma.DateTimeFilter;
  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00.000Z`);
    if (!Number.isNaN(from.getTime())) {
      startsAt.gte = from > now ? from : now;
    }
  }
  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59.999Z`);
    if (!Number.isNaN(to.getTime())) {
      startsAt.lte = to;
    }
  }
  where.startsAt = startsAt;

  const [events, total, categories] = await Promise.all([
    prisma.event.findMany({
      where,
      select: eventListSelect,
      orderBy: [{ startsAt: "asc" }, { title: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.event.count({ where }),
    prisma.category.findMany({
      where: { collegeId: college.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const eventIds = events.map((event) => event.id);
  const [savedRows, registrationRows] = profile
    ? await Promise.all([
        prisma.savedEvent.findMany({
          where: { collegeId: college.id, studentProfileId: profile.id, eventId: { in: eventIds } },
          select: { eventId: true },
        }),
        prisma.eventRegistration.findMany({
          where: { collegeId: college.id, studentProfileId: profile.id, eventId: { in: eventIds } },
          select: { eventId: true },
        }),
      ])
    : [[], []];

  return {
    events,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    categories,
    savedEventIds: new Set(savedRows.map((row) => row.eventId)),
    registeredEventIds: new Set(registrationRows.map((row) => row.eventId)),
    filters: { q, category, dateFrom, dateTo },
  };
}

export async function getStudentEvent(actor: AuthenticatedActor, eventId: string) {
  const { profile, college } = await getStudentContext(actor);

  if (!college) {
    return null;
  }

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      collegeId: college.id,
      status: "PUBLISHED",
      deletedAt: null,
      club: { status: "ACTIVE", deletedAt: null },
    },
    select: eventDetailSelect,
  });

  if (!event) {
    return null;
  }

  const [registration, saved, activeCount, conflicts] = await Promise.all([
    profile
      ? prisma.eventRegistration.findUnique({
          where: {
            eventId_studentProfileId: { eventId: event.id, studentProfileId: profile.id },
          },
          select: { id: true, status: true, registeredAt: true, cancelledAt: true },
        })
      : null,
    profile
      ? prisma.savedEvent.findUnique({
          where: {
            studentProfileId_eventId: { studentProfileId: profile.id, eventId: event.id },
          },
          select: { id: true },
        })
      : null,
    activeRegistrationCounts([event.id], college.id).then((counts) => counts.get(event.id) ?? 0),
    profile ? getScheduleConflictsForEvent(actor, event.id) : Promise.resolve([]),
  ]);

  return {
    event,
    registration,
    saved: Boolean(saved),
    activeCount,
    timezone: college.timezone,
    categories: eventCategories(event),
    conflicts,
  };
}

export async function getStudentRegistrations(actor: AuthenticatedActor) {
  const { profile, college } = await getStudentContext(actor);

  if (!profile || !college) {
    return {
      upcoming: [],
      past: [],
      counts: { total: 0, confirmed: 0, attended: 0, cancelled: 0 },
    };
  }

  const now = new Date();
  const registrations = await prisma.eventRegistration.findMany({
    where: { collegeId: college.id, studentProfileId: profile.id },
    select: {
      id: true,
      status: true,
      registeredAt: true,
      cancelledAt: true,
      checkedInAt: true,
      event: { select: eventListSelect },
    },
    orderBy: { event: { startsAt: "desc" } },
  });

  const counts = registrations.reduce(
    (accumulator, registration) => {
      accumulator.total += 1;
      if (registration.status === "CONFIRMED") accumulator.confirmed += 1;
      if (registration.status === "ATTENDED") accumulator.attended += 1;
      if (registration.status === "CANCELLED") accumulator.cancelled += 1;
      return accumulator;
    },
    { total: 0, confirmed: 0, attended: 0, cancelled: 0 },
  );

  const upcoming = registrations.filter(
    (registration) => registration.event.startsAt >= now && registration.status === "CONFIRMED",
  );
  const conflictsByEventId = new Map<string, ScheduleConflict[]>();

  for (let leftIndex = 0; leftIndex < upcoming.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < upcoming.length; rightIndex += 1) {
      const left = upcoming[leftIndex];
      const right = upcoming[rightIndex];
      const leftConflicts = detectScheduleConflicts(left.event, [right.event]);
      const rightConflicts = detectScheduleConflicts(right.event, [left.event]);

      if (leftConflicts.length) {
        conflictsByEventId.set(left.event.id, [
          ...(conflictsByEventId.get(left.event.id) ?? []),
          ...leftConflicts,
        ]);
      }
      if (rightConflicts.length) {
        conflictsByEventId.set(right.event.id, [
          ...(conflictsByEventId.get(right.event.id) ?? []),
          ...rightConflicts,
        ]);
      }
    }
  }

  return {
    upcoming: upcoming.map((registration) => ({
      ...registration,
      conflicts: conflictsByEventId.get(registration.event.id) ?? [],
    })),
    past: registrations
      .filter(
        (registration) => registration.event.startsAt < now || registration.status !== "CONFIRMED",
      )
      .map((registration) => ({
        ...registration,
        conflicts: [] as ScheduleConflict[],
      })),
    counts,
  };
}

export async function getStudentSavedEvents(actor: AuthenticatedActor) {
  const { profile, college } = await getStudentContext(actor);

  if (!profile || !college) {
    return [];
  }

  const rows = await prisma.savedEvent.findMany({
    where: { collegeId: college.id, studentProfileId: profile.id },
    select: { id: true, createdAt: true, event: { select: eventListSelect } },
    orderBy: { createdAt: "desc" },
  });

  return rows;
}

export async function getStudentCalendar(actor: AuthenticatedActor) {
  const { profile, college } = await getStudentContext(actor);

  if (!profile || !college) {
    return { timezone: "Asia/Kolkata", groups: [] as { date: string; items: never[] }[] };
  }

  const registrations = await prisma.eventRegistration.findMany({
    where: {
      collegeId: college.id,
      studentProfileId: profile.id,
      status: { in: ["CONFIRMED", "ATTENDED", "NO_SHOW"] },
    },
    select: {
      id: true,
      status: true,
      event: { select: eventListSelect },
    },
    orderBy: { event: { startsAt: "asc" } },
  });

  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: college.timezone,
  });

  const groups = new Map<string, typeof registrations>();

  for (const registration of registrations) {
    const key = formatter.format(registration.event.startsAt);
    const existing = groups.get(key) ?? [];
    existing.push(registration);
    groups.set(key, existing);
  }

  return {
    timezone: college.timezone,
    groups: [...groups.entries()].map(([date, items]) => ({ date, items })),
  };
}

const NOTIFICATION_TYPES = new Set<NotificationType>([
  "SYSTEM",
  "EVENT_REMINDER",
  "REGISTRATION_UPDATE",
  "ATTENDANCE_UPDATE",
  "FEEDBACK_UPDATE",
  "MODERATION_UPDATE",
  "CLUB_UPDATE",
]);

function safeNotificationActionUrl(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export type NotificationFilters = {
  filter?: string;
  type?: string;
  page?: number;
  pageSize?: number;
};

export async function getStudentNotifications(
  actor: AuthenticatedActor,
  filters: NotificationFilters = {},
) {
  const { college } = await getStudentContext(actor);

  if (!college) {
    return {
      notifications: [],
      unread: 0,
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      filters: { filter: "all", type: "" },
      typeCounts: [] as { type: NotificationType; count: number }[],
    };
  }

  const unreadOnly = filters.filter === "unread";
  const type =
    filters.type && NOTIFICATION_TYPES.has(filters.type as NotificationType)
      ? (filters.type as NotificationType)
      : null;
  const pageSize = Math.min(Math.max(filters.pageSize ?? 10, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  const where: Prisma.NotificationWhereInput = {
    collegeId: college.id,
    userId: actor.id,
    ...(unreadOnly ? { readAt: null } : {}),
    ...(type ? { type } : {}),
  };

  const [notifications, unread, total, typeCounts] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where: { collegeId: college.id, userId: actor.id, readAt: null } }),
    prisma.notification.count({ where }),
    prisma.notification.groupBy({
      by: ["type"],
      where: { collegeId: college.id, userId: actor.id },
      _count: { _all: true },
      orderBy: { type: "asc" },
    }),
  ]);

  return {
    notifications: notifications.map((notification) => ({
      ...notification,
      actionUrl: safeNotificationActionUrl(notification.actionUrl),
    })),
    unread,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    filters: { filter: unreadOnly ? "unread" : "all", type: type ?? "" },
    typeCounts: typeCounts.map((row) => ({ type: row.type, count: row._count._all })),
  };
}

export async function getStudentProfile(actor: AuthenticatedActor) {
  return getStudentContext(actor);
}

export function registrationStatusLabel(status: RegistrationStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function eventStatusLabel(status: EventStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const clubSummarySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  statusReason: true,
  approvedAt: true,
  createdAt: true,
  collegeId: true,
} satisfies Prisma.ClubSelect;

export type ClubSummary = Prisma.ClubGetPayload<{ select: typeof clubSummarySelect }>;

export async function getClubWorkspace(actor: AuthenticatedActor, requestedClubId?: string) {
  assertClubDashboard(actor);

  const ids = managedClubIds(actor);

  const clubs = await prisma.club.findMany({
    where: {
      collegeId: actor.collegeId!,
      id: { in: ids },
      deletedAt: null,
    },
    select: clubSummarySelect,
    orderBy: { name: "asc" },
  });

  if (requestedClubId) {
    const requested = clubs.find((club) => club.id === requestedClubId);

    if (!requested) {
      throw new TenantIsolationError();
    }

    return { clubs, club: requested };
  }

  return { clubs, club: clubs[0] ?? null };
}

export async function getClubEventFormOptions(actor: AuthenticatedActor) {
  assertClubDashboard(actor);

  const [categories, interests] = await Promise.all([
    prisma.category.findMany({
      where: { collegeId: actor.collegeId!, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
    prisma.interest.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return { categories, interests };
}

export async function getClubDashboard(actor: AuthenticatedActor, requestedClubId?: string) {
  const workspace = await getClubWorkspace(actor, requestedClubId);

  if (!workspace.club) {
    return {
      ...workspace,
      counts: { total: 0, draft: 0, pending: 0, published: 0, cancelled: 0, completed: 0 },
      upcoming: [] as DashboardEvent[],
      drafts: [] as DashboardEvent[],
      pending: [] as DashboardEvent[],
      recent: [] as { id: string; title: string; status: EventStatus; updatedAt: Date }[],
      registrationCount: 0,
    };
  }

  const clubId = workspace.club.id;
  const collegeId = workspace.club.collegeId;
  const now = new Date();

  const [statusRows, upcoming, drafts, pending, recent, registrationCount] = await Promise.all([
    prisma.event.groupBy({
      by: ["status"],
      where: { collegeId, clubId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.event.findMany({
      where: {
        collegeId,
        clubId,
        status: "PUBLISHED",
        deletedAt: null,
        startsAt: { gte: now },
      },
      select: eventListSelect,
      orderBy: { startsAt: "asc" },
      take: 4,
    }),
    prisma.event.findMany({
      where: { collegeId, clubId, status: "DRAFT", deletedAt: null },
      select: eventListSelect,
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.event.findMany({
      where: { collegeId, clubId, status: "PENDING_APPROVAL", deletedAt: null },
      select: eventListSelect,
      orderBy: { updatedAt: "asc" },
      take: 4,
    }),
    prisma.event.findMany({
      where: { collegeId, clubId, deletedAt: null },
      select: { id: true, title: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.eventRegistration.count({
      where: { collegeId, event: { clubId, deletedAt: null } },
    }),
  ]);

  const counts = {
    total: 0,
    draft: 0,
    pending: 0,
    published: 0,
    cancelled: 0,
    completed: 0,
  };

  for (const row of statusRows) {
    counts.total += row._count._all;
    if (row.status === "DRAFT") counts.draft = row._count._all;
    if (row.status === "PENDING_APPROVAL") counts.pending = row._count._all;
    if (row.status === "PUBLISHED") counts.published = row._count._all;
    if (row.status === "CANCELLED") counts.cancelled = row._count._all;
    if (row.status === "COMPLETED") counts.completed = row._count._all;
  }

  return {
    ...workspace,
    counts,
    upcoming,
    drafts,
    pending,
    recent,
    registrationCount,
  };
}

export async function getClubEvents(
  actor: AuthenticatedActor,
  requestedClubId?: string,
  status?: string,
) {
  const workspace = await getClubWorkspace(actor, requestedClubId);

  if (!workspace.club) {
    return { ...workspace, events: [] as DashboardEvent[] };
  }

  const allowedStatuses = new Set([
    "DRAFT",
    "PENDING_APPROVAL",
    "PUBLISHED",
    "REJECTED",
    "CANCELLED",
    "COMPLETED",
  ]);

  const events = await prisma.event.findMany({
    where: {
      collegeId: workspace.club.collegeId,
      clubId: workspace.club.id,
      deletedAt: null,
      ...(status && allowedStatuses.has(status) ? { status: status as EventStatus } : {}),
    },
    select: eventListSelect,
    orderBy: [{ startsAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return { ...workspace, events };
}

export async function getClubEvent(
  actor: AuthenticatedActor,
  requestedClubId: string | undefined,
  eventId: string,
) {
  const workspace = await getClubWorkspace(actor, requestedClubId);

  if (!workspace.club) {
    return null;
  }

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      collegeId: workspace.club.collegeId,
      clubId: workspace.club.id,
      deletedAt: null,
    },
    select: eventDetailSelect,
  });

  if (!event) {
    return null;
  }

  const activeCount =
    (await activeRegistrationCounts([event.id], event.collegeId)).get(event.id) ?? 0;

  return { ...workspace, event, activeCount };
}

export async function getClubRegistrations(
  actor: AuthenticatedActor,
  requestedClubId?: string,
  eventId?: string,
) {
  const workspace = await getClubWorkspace(actor, requestedClubId);

  if (!workspace.club) {
    return {
      ...workspace,
      events: [] as {
        id: string;
        title: string;
        startsAt: Date;
        status: EventStatus;
        registrationCount: number;
      }[],
      selectedEvent: null,
      registrations: [],
      counts: { total: 0, confirmed: 0, cancelled: 0, attended: 0, noShow: 0 },
    };
  }

  const eventRows = await prisma.event.findMany({
    where: { collegeId: workspace.club.collegeId, clubId: workspace.club.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      startsAt: true,
      status: true,
      _count: { select: { registrations: true } },
    },
    orderBy: { startsAt: "desc" },
    take: 100,
  });

  const events = eventRows.map((event) => ({
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    status: event.status,
    registrationCount: event._count.registrations,
  }));

  const selectedEvent = eventId
    ? (events.find((event) => event.id === eventId) ?? null)
    : (events[0] ?? null);

  if (eventId && !selectedEvent) {
    throw new TenantIsolationError();
  }

  if (!selectedEvent) {
    return {
      ...workspace,
      events,
      selectedEvent: null,
      registrations: [],
      counts: { total: 0, confirmed: 0, cancelled: 0, attended: 0, noShow: 0 },
    };
  }

  const registrations = await prisma.eventRegistration.findMany({
    where: { collegeId: workspace.club.collegeId, eventId: selectedEvent.id },
    select: {
      id: true,
      status: true,
      registeredAt: true,
      cancelledAt: true,
      checkedInAt: true,
      studentProfile: {
        select: {
          id: true,
          rollNumber: true,
          department: true,
          graduationYear: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { registeredAt: "asc" },
  });

  const counts = registrations.reduce(
    (accumulator, registration) => {
      accumulator.total += 1;
      if (registration.status === "CONFIRMED") accumulator.confirmed += 1;
      if (registration.status === "CANCELLED") accumulator.cancelled += 1;
      if (registration.status === "ATTENDED") accumulator.attended += 1;
      if (registration.status === "NO_SHOW") accumulator.noShow += 1;
      return accumulator;
    },
    { total: 0, confirmed: 0, cancelled: 0, attended: 0, noShow: 0 },
  );

  return { ...workspace, events, selectedEvent, registrations, counts };
}

export async function getClubAttendance(
  actor: AuthenticatedActor,
  requestedClubId?: string,
  eventId?: string,
) {
  const workspace = await getClubWorkspace(actor, requestedClubId);

  if (!workspace.club) {
    return {
      ...workspace,
      events: [] as { id: string; title: string; startsAt: Date; status: EventStatus }[],
      selectedEvent: null,
      registrations: [],
      counts: { confirmed: 0, attended: 0, noShow: 0 },
    };
  }

  const now = new Date();
  const eventRows = await prisma.event.findMany({
    where: {
      collegeId: workspace.club.collegeId,
      clubId: workspace.club.id,
      deletedAt: null,
      status: { in: ["PUBLISHED", "COMPLETED"] },
      startsAt: { lte: now },
    },
    select: { id: true, title: true, startsAt: true, status: true },
    orderBy: { startsAt: "desc" },
    take: 100,
  });

  const selectedEvent = eventId
    ? (eventRows.find((event) => event.id === eventId) ?? null)
    : (eventRows[0] ?? null);

  if (eventId && !selectedEvent) {
    throw new TenantIsolationError();
  }

  if (!selectedEvent) {
    return {
      ...workspace,
      events: eventRows,
      selectedEvent: null,
      registrations: [],
      counts: { confirmed: 0, attended: 0, noShow: 0 },
    };
  }

  const registrations = await prisma.eventRegistration.findMany({
    where: {
      collegeId: workspace.club.collegeId,
      eventId: selectedEvent.id,
      status: { in: ["CONFIRMED", "ATTENDED", "NO_SHOW"] },
    },
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      studentProfile: {
        select: {
          id: true,
          rollNumber: true,
          department: true,
          user: { select: { name: true } },
        },
      },
    },
    orderBy: { registeredAt: "asc" },
  });

  const counts = registrations.reduce(
    (accumulator, registration) => {
      if (registration.status === "CONFIRMED") accumulator.confirmed += 1;
      if (registration.status === "ATTENDED") accumulator.attended += 1;
      if (registration.status === "NO_SHOW") accumulator.noShow += 1;
      return accumulator;
    },
    { confirmed: 0, attended: 0, noShow: 0 },
  );

  return { ...workspace, events: eventRows, selectedEvent, registrations, counts };
}

export async function getClubAnalytics(actor: AuthenticatedActor, requestedClubId?: string) {
  const workspace = await getClubWorkspace(actor, requestedClubId);

  if (!workspace.club) {
    return {
      ...workspace,
      eventCounts: [] as { status: EventStatus; count: number }[],
      registrationCounts: [] as { status: RegistrationStatus; count: number }[],
      totalRegistrations: 0,
      eventBreakdown: [] as {
        id: string;
        title: string;
        startsAt: Date;
        status: EventStatus;
        count: number;
      }[],
      categoryBreakdown: [] as { name: string; count: number }[],
    };
  }

  const [eventRows, registrationRows, events] = await Promise.all([
    prisma.event.groupBy({
      by: ["status"],
      where: { collegeId: workspace.club.collegeId, clubId: workspace.club.id, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.eventRegistration.groupBy({
      by: ["status"],
      where: { collegeId: workspace.club.collegeId, event: { clubId: workspace.club.id } },
      _count: { _all: true },
    }),
    prisma.event.findMany({
      where: { collegeId: workspace.club.collegeId, clubId: workspace.club.id, deletedAt: null },
      select: {
        id: true,
        title: true,
        startsAt: true,
        status: true,
        categories: { select: { category: { select: { name: true } } } },
        _count: { select: { registrations: true } },
      },
      orderBy: { startsAt: "desc" },
      take: 30,
    }),
  ]);

  const categoryMap = new Map<string, number>();

  for (const event of events) {
    for (const category of event.categories) {
      categoryMap.set(category.category.name, (categoryMap.get(category.category.name) ?? 0) + 1);
    }
  }

  return {
    ...workspace,
    eventCounts: eventRows.map((row) => ({ status: row.status, count: row._count._all })),
    registrationCounts: registrationRows.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    totalRegistrations: registrationRows.reduce((sum, row) => sum + row._count._all, 0),
    eventBreakdown: events.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      status: event.status,
      count: event._count.registrations,
    })),
    categoryBreakdown: [...categoryMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function getClubSettings(actor: AuthenticatedActor, requestedClubId?: string) {
  const workspace = await getClubWorkspace(actor, requestedClubId);
  return workspace;
}

export async function getCollegeContext(actor: AuthenticatedActor) {
  const collegeId = assertCollegeDashboard(actor);

  const college = await prisma.college.findFirst({
    where: { id: collegeId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      shortName: true,
      primaryDomain: true,
      timezone: true,
      status: true,
      createdAt: true,
    },
  });

  if (!college) {
    throw new TenantIsolationError();
  }

  return college;
}

export async function getCollegeDashboard(actor: AuthenticatedActor) {
  const college = await getCollegeContext(actor);
  const now = new Date();

  const [
    clubStatusRows,
    eventStatusRows,
    registrationCount,
    pendingClubs,
    pendingEvents,
    upcomingEvents,
    recentAudit,
  ] = await Promise.all([
    prisma.club.groupBy({
      by: ["status"],
      where: { collegeId: college.id, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.event.groupBy({
      by: ["status"],
      where: { collegeId: college.id, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.eventRegistration.count({ where: { collegeId: college.id } }),
    prisma.club.findMany({
      where: { collegeId: college.id, status: "PENDING", deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.event.findMany({
      where: { collegeId: college.id, status: "PENDING_APPROVAL", deletedAt: null },
      select: eventListSelect,
      orderBy: { updatedAt: "asc" },
      take: 5,
    }),
    prisma.event.findMany({
      where: {
        collegeId: college.id,
        status: "PUBLISHED",
        deletedAt: null,
        startsAt: { gte: now },
        club: { status: "ACTIVE", deletedAt: null },
      },
      select: eventListSelect,
      orderBy: { startsAt: "asc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      where: { collegeId: college.id },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const clubCounts = { total: 0, active: 0, pending: 0, rejected: 0, suspended: 0, archived: 0 };
  for (const row of clubStatusRows) {
    clubCounts.total += row._count._all;
    if (row.status === "ACTIVE") clubCounts.active = row._count._all;
    if (row.status === "PENDING") clubCounts.pending = row._count._all;
    if (row.status === "REJECTED") clubCounts.rejected = row._count._all;
    if (row.status === "SUSPENDED") clubCounts.suspended = row._count._all;
    if (row.status === "ARCHIVED") clubCounts.archived = row._count._all;
  }

  const eventCounts = {
    total: 0,
    draft: 0,
    pending: 0,
    published: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0,
  };
  for (const row of eventStatusRows) {
    eventCounts.total += row._count._all;
    if (row.status === "DRAFT") eventCounts.draft = row._count._all;
    if (row.status === "PENDING_APPROVAL") eventCounts.pending = row._count._all;
    if (row.status === "PUBLISHED") eventCounts.published = row._count._all;
    if (row.status === "REJECTED") eventCounts.rejected = row._count._all;
    if (row.status === "CANCELLED") eventCounts.cancelled = row._count._all;
    if (row.status === "COMPLETED") eventCounts.completed = row._count._all;
  }

  return {
    college,
    clubCounts,
    eventCounts,
    registrationCount,
    pendingClubs,
    pendingEvents,
    upcomingEvents,
    recentAudit,
  };
}

export async function getCollegeEvents(actor: AuthenticatedActor, status?: string) {
  const college = await getCollegeContext(actor);
  const allowedStatuses = new Set([
    "DRAFT",
    "PENDING_APPROVAL",
    "PUBLISHED",
    "REJECTED",
    "CANCELLED",
    "COMPLETED",
  ]);

  const events = await prisma.event.findMany({
    where: {
      collegeId: college.id,
      deletedAt: null,
      ...(status && allowedStatuses.has(status) ? { status: status as EventStatus } : {}),
    },
    select: eventListSelect,
    orderBy: [{ startsAt: "desc" }, { updatedAt: "desc" }],
    take: 150,
  });

  return { college, events };
}

export async function getCollegeApprovals(actor: AuthenticatedActor) {
  const college = await getCollegeContext(actor);

  const [pendingEvents, pendingClubs, pendingDuplicates, recentlyDecided] = await Promise.all([
    prisma.event.findMany({
      where: { collegeId: college.id, status: "PENDING_APPROVAL", deletedAt: null },
      select: eventListSelect,
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),
    prisma.club.findMany({
      where: { collegeId: college.id, status: "PENDING", deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
        _count: { select: { memberships: true, events: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    getPendingDuplicateReviewsForCollege(actor),
    prisma.auditLog.findMany({
      where: {
        collegeId: college.id,
        action: { in: ["EVENT_APPROVED", "EVENT_REJECTED", "CLUB_APPROVED", "CLUB_REJECTED"] },
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return { college, pendingEvents, pendingClubs, pendingDuplicates, recentlyDecided };
}

export async function getCollegeClubs(actor: AuthenticatedActor, status?: string) {
  const college = await getCollegeContext(actor);
  const allowedStatuses = new Set(["PENDING", "ACTIVE", "REJECTED", "SUSPENDED", "ARCHIVED"]);

  const clubs = await prisma.club.findMany({
    where: {
      collegeId: college.id,
      deletedAt: null,
      ...(status && allowedStatuses.has(status)
        ? { status: status as Prisma.ClubWhereInput["status"] }
        : {}),
    },
    select: {
      ...clubSummarySelect,
      createdBy: { select: { name: true, email: true } },
      _count: { select: { memberships: true, events: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 200,
  });

  return { college, clubs };
}

export async function getCollegeClub(actor: AuthenticatedActor, clubId: string) {
  const college = await getCollegeContext(actor);

  const club = await prisma.club.findFirst({
    where: { id: clubId, collegeId: college.id, deletedAt: null },
    select: {
      ...clubSummarySelect,
      createdBy: { select: { name: true, email: true } },
      memberships: {
        select: {
          id: true,
          role: true,
          status: true,
          joinedAt: true,
          user: { select: { id: true, name: true, email: true, role: true, status: true } },
        },
        orderBy: [{ status: "asc" }, { role: "asc" }],
      },
      events: {
        select: eventListSelect,
        orderBy: { startsAt: "desc" },
        take: 20,
      },
    },
  });

  if (!club) {
    return null;
  }

  return { college, club };
}

export type CollegeUserFilters = {
  q?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

export async function getCollegeUsers(actor: AuthenticatedActor, filters: CollegeUserFilters) {
  const college = await getCollegeContext(actor);
  const q = filters.q?.trim() ?? "";
  const role = filters.role?.trim() ?? "";
  const status = filters.status?.trim() ?? "";
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);

  const allowedRoles = new Set(["STUDENT", "CLUB_ADMIN", "COLLEGE_ADMIN", "SUPER_ADMIN"]);
  const allowedStatuses = new Set(["ACTIVE", "INVITED", "SUSPENDED", "DISABLED"]);

  const where: Prisma.UserWhereInput = {
    collegeId: college.id,
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(allowedRoles.has(role) ? { role: role as Prisma.UserWhereInput["role"] } : {}),
    ...(allowedStatuses.has(status) ? { status: status as Prisma.UserWhereInput["status"] } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastSeenAt: true,
        studentProfile: { select: { rollNumber: true, department: true, graduationYear: true } },
        clubMemberships: {
          where: { status: "ACTIVE" },
          select: { role: true, club: { select: { name: true } } },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    college,
    users,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    filters: { q, role, status },
  };
}

export async function getCollegeAnalytics(actor: AuthenticatedActor) {
  const college = await getCollegeContext(actor);
  const since = new Date();
  since.setMonth(since.getMonth() - 6);

  const [eventStatusRows, registrationStatusRows, events, registrations, categoryRows, auditRows] =
    await Promise.all([
      prisma.event.groupBy({
        by: ["status"],
        where: { collegeId: college.id, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.eventRegistration.groupBy({
        by: ["status"],
        where: { collegeId: college.id },
        _count: { _all: true },
      }),
      prisma.event.findMany({
        where: { collegeId: college.id, deletedAt: null, startsAt: { gte: since } },
        select: { startsAt: true, clubId: true, club: { select: { name: true } } },
        orderBy: { startsAt: "asc" },
      }),
      prisma.eventRegistration.findMany({
        where: { collegeId: college.id, registeredAt: { gte: since } },
        select: { registeredAt: true },
        orderBy: { registeredAt: "asc" },
      }),
      prisma.eventCategory.groupBy({
        by: ["categoryId"],
        where: { event: { collegeId: college.id, deletedAt: null } },
        _count: { _all: true },
      }),
      prisma.auditLog.findMany({
        where: {
          collegeId: college.id,
          action: { in: ["EVENT_APPROVED", "EVENT_REJECTED", "CLUB_APPROVED", "CLUB_REJECTED"] },
          createdAt: { gte: since },
        },
        select: { action: true, createdAt: true },
      }),
    ]);

  const categoryIds = categoryRows.map((row) => row.categoryId);
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  const monthFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: college.timezone,
  });

  const eventMonths = new Map<string, number>();
  const registrationMonths = new Map<string, number>();
  const clubActivity = new Map<string, number>();

  for (const event of events) {
    const key = monthFormatter.format(event.startsAt);
    eventMonths.set(key, (eventMonths.get(key) ?? 0) + 1);
    clubActivity.set(event.club.name, (clubActivity.get(event.club.name) ?? 0) + 1);
  }

  for (const registration of registrations) {
    const key = monthFormatter.format(registration.registeredAt);
    registrationMonths.set(key, (registrationMonths.get(key) ?? 0) + 1);
  }

  const approvalActivity = auditRows.reduce(
    (accumulator, row) => {
      if (row.action === "EVENT_APPROVED") accumulator.eventApproved += 1;
      if (row.action === "EVENT_REJECTED") accumulator.eventRejected += 1;
      if (row.action === "CLUB_APPROVED") accumulator.clubApproved += 1;
      if (row.action === "CLUB_REJECTED") accumulator.clubRejected += 1;
      return accumulator;
    },
    { eventApproved: 0, eventRejected: 0, clubApproved: 0, clubRejected: 0 },
  );

  return {
    college,
    eventStatusCounts: eventStatusRows.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    registrationStatusCounts: registrationStatusRows.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    eventMonths: [...eventMonths.entries()].map(([month, count]) => ({ month, count })),
    registrationMonths: [...registrationMonths.entries()].map(([month, count]) => ({
      month,
      count,
    })),
    categoryBreakdown: categoryRows
      .map((row) => ({
        name: categoryNameById.get(row.categoryId) ?? "Uncategorized",
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count),
    clubActivity: [...clubActivity.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    approvalActivity,
  };
}

export async function getCollegeAuditLogs(
  actor: AuthenticatedActor,
  filters: { page?: number; action?: string } = {},
) {
  const college = await getCollegeContext(actor);
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = 30;
  const allowedActions = new Set([
    "USER_ROLE_CHANGED",
    "USER_STATUS_CHANGED",
    "USER_PROFILE_UPDATED",
    "COLLEGE_UPDATED",
    "CLUB_APPROVED",
    "CLUB_REJECTED",
    "CLUB_UPDATED",
    "EVENT_CREATED",
    "EVENT_UPDATED",
    "EVENT_APPROVED",
    "EVENT_REJECTED",
    "EVENT_CANCELLED",
    "EVENT_STATUS_CHANGED",
    "REGISTRATION_STATUS_CHANGED",
    "SAVED_EVENT_CHANGED",
    "NOTIFICATION_READ",
  ]);

  const where: Prisma.AuditLogWhereInput = {
    collegeId: college.id,
    ...(filters.action && allowedActions.has(filters.action)
      ? { action: filters.action as Prisma.AuditLogWhereInput["action"] }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    college,
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  };
}

export async function getCollegeSettings(actor: AuthenticatedActor) {
  const college = await getCollegeContext(actor);
  return { college };
}

export async function getCollegeEvent(actor: AuthenticatedActor, eventId: string) {
  const college = await getCollegeContext(actor);

  const event = await prisma.event.findFirst({
    where: { id: eventId, collegeId: college.id, deletedAt: null },
    select: eventDetailSelect,
  });

  if (!event) {
    return null;
  }

  const duplicates: DuplicateReview[] = await getDuplicateReviewsForEvent(actor, event.id);

  return { college, event, duplicates };
}

export async function getPlatformDashboard(actor: AuthenticatedActor) {
  assertPlatformDashboard(actor);

  const [
    collegeStatusRows,
    userStatusRows,
    clubStatusRows,
    eventStatusRows,
    registrationCount,
    recentAudit,
    recentColleges,
  ] = await Promise.all([
    prisma.college.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.club.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.event.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.eventRegistration.count(),
    prisma.auditLog.findMany({
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: { select: { name: true } },
        college: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.college.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        shortName: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true, clubs: true, events: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const collegeCounts = { total: 0, active: 0, suspended: 0, archived: 0 };
  for (const row of collegeStatusRows) {
    collegeCounts.total += row._count._all;
    if (row.status === "ACTIVE") collegeCounts.active = row._count._all;
    if (row.status === "SUSPENDED") collegeCounts.suspended = row._count._all;
    if (row.status === "ARCHIVED") collegeCounts.archived = row._count._all;
  }

  const userCounts = { total: 0, active: 0, invited: 0, suspended: 0, disabled: 0 };
  for (const row of userStatusRows) {
    userCounts.total += row._count._all;
    if (row.status === "ACTIVE") userCounts.active = row._count._all;
    if (row.status === "INVITED") userCounts.invited = row._count._all;
    if (row.status === "SUSPENDED") userCounts.suspended = row._count._all;
    if (row.status === "DISABLED") userCounts.disabled = row._count._all;
  }

  const clubCounts = { total: 0, active: 0, pending: 0, rejected: 0, suspended: 0, archived: 0 };
  for (const row of clubStatusRows) {
    clubCounts.total += row._count._all;
    if (row.status === "ACTIVE") clubCounts.active = row._count._all;
    if (row.status === "PENDING") clubCounts.pending = row._count._all;
    if (row.status === "REJECTED") clubCounts.rejected = row._count._all;
    if (row.status === "SUSPENDED") clubCounts.suspended = row._count._all;
    if (row.status === "ARCHIVED") clubCounts.archived = row._count._all;
  }

  const eventCounts = {
    total: 0,
    published: 0,
    pending: 0,
    draft: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0,
  };
  for (const row of eventStatusRows) {
    eventCounts.total += row._count._all;
    if (row.status === "PUBLISHED") eventCounts.published = row._count._all;
    if (row.status === "PENDING_APPROVAL") eventCounts.pending = row._count._all;
    if (row.status === "DRAFT") eventCounts.draft = row._count._all;
    if (row.status === "REJECTED") eventCounts.rejected = row._count._all;
    if (row.status === "CANCELLED") eventCounts.cancelled = row._count._all;
    if (row.status === "COMPLETED") eventCounts.completed = row._count._all;
  }

  return {
    collegeCounts,
    userCounts,
    clubCounts,
    eventCounts,
    registrationCount,
    recentAudit,
    recentColleges,
  };
}

export async function getPlatformColleges(
  actor: AuthenticatedActor,
  filters: { q?: string; status?: string; page?: number } = {},
) {
  assertPlatformDashboard(actor);
  const q = filters.q?.trim() ?? "";
  const status = filters.status?.trim() ?? "";
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = 20;
  const allowedStatuses = new Set(["ACTIVE", "SUSPENDED", "ARCHIVED"]);

  const where: Prisma.CollegeWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { primaryDomain: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(allowedStatuses.has(status)
      ? { status: status as Prisma.CollegeWhereInput["status"] }
      : {}),
  };

  const [colleges, total] = await Promise.all([
    prisma.college.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        shortName: true,
        primaryDomain: true,
        timezone: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true, clubs: true, events: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.college.count({ where }),
  ]);

  return {
    colleges,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    filters: { q, status },
  };
}

export async function getPlatformCollege(actor: AuthenticatedActor, collegeId: string) {
  assertPlatformDashboard(actor);

  const college = await prisma.college.findFirst({
    where: { id: collegeId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      shortName: true,
      primaryDomain: true,
      timezone: true,
      status: true,
      createdAt: true,
      _count: { select: { users: true, clubs: true, events: true } },
      users: {
        select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      clubs: {
        select: { id: true, name: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      auditLogs: {
        select: { id: true, action: true, entityType: true, entityId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!college) {
    return null;
  }

  return college;
}

export type PlatformUserFilters = {
  q?: string;
  role?: string;
  status?: string;
  collegeId?: string;
  page?: number;
};

export async function getPlatformUsers(actor: AuthenticatedActor, filters: PlatformUserFilters) {
  assertPlatformDashboard(actor);
  const q = filters.q?.trim() ?? "";
  const role = filters.role?.trim() ?? "";
  const status = filters.status?.trim() ?? "";
  const collegeId = filters.collegeId?.trim() ?? "";
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = 30;
  const allowedRoles = new Set(["STUDENT", "CLUB_ADMIN", "COLLEGE_ADMIN", "SUPER_ADMIN"]);
  const allowedStatuses = new Set(["ACTIVE", "INVITED", "SUSPENDED", "DISABLED"]);

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(allowedRoles.has(role) ? { role: role as Prisma.UserWhereInput["role"] } : {}),
    ...(allowedStatuses.has(status) ? { status: status as Prisma.UserWhereInput["status"] } : {}),
    ...(collegeId ? { collegeId } : {}),
  };

  const [users, total, colleges] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastSeenAt: true,
        college: { select: { id: true, name: true, shortName: true } },
        studentProfile: { select: { rollNumber: true, department: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
    prisma.college.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, shortName: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    users,
    total,
    colleges,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    filters: { q, role, status, collegeId },
  };
}

export async function getPlatformAnalytics(actor: AuthenticatedActor) {
  assertPlatformDashboard(actor);
  const since = new Date();
  since.setMonth(since.getMonth() - 6);

  const [
    collegeStatusRows,
    userRoleRows,
    userStatusRows,
    eventStatusRows,
    users,
    events,
    colleges,
  ] = await Promise.all([
    prisma.college.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.event.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.user.findMany({
      where: { deletedAt: null, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.event.findMany({
      where: { deletedAt: null, startsAt: { gte: since } },
      select: { startsAt: true, collegeId: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.college.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        _count: { select: { users: true, events: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const monthFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "UTC",
  });

  const userMonths = new Map<string, number>();
  const eventMonths = new Map<string, number>();

  for (const user of users) {
    const key = monthFormatter.format(user.createdAt);
    userMonths.set(key, (userMonths.get(key) ?? 0) + 1);
  }

  for (const event of events) {
    const key = monthFormatter.format(event.startsAt);
    eventMonths.set(key, (eventMonths.get(key) ?? 0) + 1);
  }

  return {
    collegeStatusCounts: collegeStatusRows.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    userRoleCounts: userRoleRows.map((row) => ({ role: row.role, count: row._count._all })),
    userStatusCounts: userStatusRows.map((row) => ({ status: row.status, count: row._count._all })),
    eventStatusCounts: eventStatusRows.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    userMonths: [...userMonths.entries()].map(([month, count]) => ({ month, count })),
    eventMonths: [...eventMonths.entries()].map(([month, count]) => ({ month, count })),
    collegeBreakdown: colleges
      .map((college) => ({
        name: college.name,
        users: college._count.users,
        events: college._count.events,
      }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 10),
  };
}

export async function getPlatformAuditLogs(
  actor: AuthenticatedActor,
  filters: { page?: number; action?: string } = {},
) {
  assertPlatformDashboard(actor);
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = 30;
  const allowedActions = new Set([
    "USER_ROLE_CHANGED",
    "USER_STATUS_CHANGED",
    "USER_PROFILE_UPDATED",
    "COLLEGE_CREATED",
    "COLLEGE_UPDATED",
    "CLUB_APPROVED",
    "CLUB_REJECTED",
    "CLUB_UPDATED",
    "EVENT_CREATED",
    "EVENT_UPDATED",
    "EVENT_APPROVED",
    "EVENT_REJECTED",
    "EVENT_CANCELLED",
    "EVENT_STATUS_CHANGED",
    "REGISTRATION_STATUS_CHANGED",
    "SAVED_EVENT_CHANGED",
    "NOTIFICATION_READ",
  ]);

  const where: Prisma.AuditLogWhereInput = {
    ...(filters.action && allowedActions.has(filters.action)
      ? { action: filters.action as Prisma.AuditLogWhereInput["action"] }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true, role: true } },
        college: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, pageSize, totalPages: Math.max(Math.ceil(total / pageSize), 1) };
}

export async function getPlatformSettings(actor: AuthenticatedActor) {
  assertPlatformDashboard(actor);

  const [collegeCount, userCount, clubCount, eventCount] = await Promise.all([
    prisma.college.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.club.count({ where: { deletedAt: null } }),
    prisma.event.count({ where: { deletedAt: null } }),
  ]);

  return {
    collegeCount,
    userCount,
    clubCount,
    eventCount,
    emailEnabled: process.env.EMAIL_ENABLED === "true",
    storageConfigured: Boolean(process.env.STORAGE_ENDPOINT),
  };
}

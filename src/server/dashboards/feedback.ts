import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import {
  assertClubDashboard,
  assertCollegeDashboard,
  assertStudentDashboard,
  managedClubIds,
} from "@/server/dashboards/access";
import { TenantIsolationError } from "@/server/errors";
import { feedbackWindowClosesAt } from "@/services/feedback";
import { uuidSchema } from "@/services/validation";

const feedbackInclude = {
  studentProfile: {
    select: {
      rollNumber: true,
      department: true,
      user: { select: { name: true } },
    },
  },
  moderatedBy: { select: { name: true } },
} satisfies Prisma.EventFeedbackInclude;

export async function getStudentFeedback(actor: Parameters<typeof assertStudentDashboard>[0]) {
  assertStudentDashboard(actor);
  const collegeId = actor.collegeId!;

  const [profile, college] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { userId_collegeId: { userId: actor.id, collegeId } },
      select: { id: true },
    }),
    prisma.college.findFirst({
      where: { id: collegeId, deletedAt: null },
      select: { timezone: true },
    }),
  ]);

  if (!college) {
    throw new TenantIsolationError();
  }

  if (!profile) {
    return {
      timezone: college.timezone,
      rows: [] as never[],
      counts: { available: 0, submitted: 0 },
    };
  }

  const registrations = await prisma.eventRegistration.findMany({
    where: {
      collegeId,
      studentProfileId: profile.id,
      status: "ATTENDED",
      event: { status: "COMPLETED", deletedAt: null },
    },
    select: {
      id: true,
      checkedInAt: true,
      event: {
        select: {
          id: true,
          title: true,
          summary: true,
          startsAt: true,
          endsAt: true,
          completedAt: true,
          status: true,
          venueName: true,
          isOnline: true,
          club: { select: { name: true } },
          feedback: {
            where: { studentProfileId: profile.id },
            select: {
              id: true,
              rating: true,
              comment: true,
              moderationStatus: true,
              createdAt: true,
              updatedAt: true,
            },
            take: 1,
          },
        },
      },
    },
    orderBy: { event: { completedAt: "desc" } },
    take: 50,
  });

  const now = new Date();
  const rows = registrations.map((registration) => {
    const feedback = registration.event.feedback[0] ?? null;
    const closesAt = feedbackWindowClosesAt(registration.event);
    const open = now <= closesAt;

    return {
      registrationId: registration.id,
      checkedInAt: registration.checkedInAt,
      event: {
        ...registration.event,
        feedback: undefined,
      },
      feedback,
      windowClosesAt: closesAt,
      canSubmit: !feedback && open,
      canEdit: Boolean(feedback) && open,
      state: feedback ? (open ? "submitted" : "closed") : open ? "available" : "closed",
    };
  });

  return {
    timezone: college.timezone,
    rows,
    counts: {
      available: rows.filter((row) => row.canSubmit).length,
      submitted: rows.filter((row) => row.feedback).length,
    },
  };
}

export type ClubFeedbackFilters = {
  eventId?: string;
  rating?: string;
  status?: string;
  page?: number;
};

export async function getClubFeedback(
  actor: Parameters<typeof assertClubDashboard>[0],
  requestedClubId?: string,
  filters: ClubFeedbackFilters = {},
) {
  assertClubDashboard(actor);
  const collegeId = actor.collegeId!;
  const ids = managedClubIds(actor);

  const clubs = await prisma.club.findMany({
    where: { collegeId, id: { in: ids }, deletedAt: null },
    select: { id: true, name: true, slug: true, collegeId: true },
    orderBy: { name: "asc" },
  });

  const club = requestedClubId ? clubs.find((item) => item.id === requestedClubId) : clubs[0];

  if (requestedClubId && !club) {
    throw new TenantIsolationError();
  }

  if (!club) {
    return {
      clubs,
      club: null,
      events: [] as { id: string; title: string; startsAt: Date }[],
      selectedEvent: null,
      feedback: [] as never[],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      filters: { rating: "", status: "ALL", eventId: "" },
      summary: {
        averageRating: null as number | null,
        responseCount: 0,
        visibleCount: 0,
        hiddenCount: 0,
        distribution: [] as { rating: number; count: number }[],
      },
    };
  }

  let events = await prisma.event.findMany({
    where: {
      collegeId,
      clubId: club.id,
      deletedAt: null,
      status: "COMPLETED",
    },
    select: { id: true, title: true, startsAt: true },
    orderBy: { startsAt: "desc" },
    take: 100,
  });
  const requestedEventId =
    filters.eventId && uuidSchema.safeParse(filters.eventId).success ? filters.eventId : "";

  let selectedEvent = requestedEventId
    ? (events.find((event) => event.id === requestedEventId) ?? null)
    : (events[0] ?? null);

  if (requestedEventId && !selectedEvent) {
    // Old bookmarked feedback links may point at an event outside the latest
    // 100. Resolve it explicitly within this club's tenant boundary.
    selectedEvent = await prisma.event.findFirst({
      where: {
        id: requestedEventId,
        collegeId,
        clubId: club.id,
        deletedAt: null,
        status: "COMPLETED",
      },
      select: { id: true, title: true, startsAt: true },
    });

    if (!selectedEvent) {
      throw new TenantIsolationError();
    }

    events = [selectedEvent, ...events];
  }

  if (!selectedEvent) {
    return {
      clubs,
      club,
      events,
      selectedEvent: null,
      feedback: [] as never[],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      filters: { rating: "", status: "ALL", eventId: "" },
      summary: {
        averageRating: null as number | null,
        responseCount: 0,
        visibleCount: 0,
        hiddenCount: 0,
        distribution: [] as { rating: number; count: number }[],
      },
    };
  }

  const rating = ["1", "2", "3", "4", "5"].includes(filters.rating ?? "")
    ? Number(filters.rating)
    : null;
  const status =
    filters.status === "VISIBLE" || filters.status === "HIDDEN" ? filters.status : "ALL";
  const pageSize = 20;
  const requestedPage = Math.max(filters.page ?? 1, 1);

  const where: Prisma.EventFeedbackWhereInput = {
    collegeId,
    eventId: selectedEvent.id,
    ...(rating ? { rating } : {}),
    ...(status === "ALL" ? {} : { moderationStatus: status }),
  };

  const [total, visibleAggregate, hiddenCount, distribution] = await Promise.all([
    prisma.eventFeedback.count({ where }),
    prisma.eventFeedback.aggregate({
      where: { collegeId, eventId: selectedEvent.id, moderationStatus: "VISIBLE" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.eventFeedback.count({
      where: { collegeId, eventId: selectedEvent.id, moderationStatus: "HIDDEN" },
    }),
    prisma.eventFeedback.groupBy({
      by: ["rating"],
      where: { collegeId, eventId: selectedEvent.id, moderationStatus: "VISIBLE" },
      _count: { _all: true },
      orderBy: { rating: "asc" },
    }),
  ]);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(requestedPage, totalPages);
  const feedback = await prisma.eventFeedback.findMany({
    where,
    include: feedbackInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    clubs,
    club,
    events,
    selectedEvent,
    feedback,
    total,
    page,
    pageSize,
    totalPages,
    filters: { rating: rating ? String(rating) : "", status, eventId: selectedEvent.id },
    summary: {
      averageRating: visibleAggregate._avg.rating,
      responseCount: visibleAggregate._count._all,
      visibleCount: visibleAggregate._count._all,
      hiddenCount,
      distribution: distribution.map((row) => ({ rating: row.rating, count: row._count._all })),
    },
  };
}

export type CollegeFeedbackFilters = {
  eventId?: string;
  clubId?: string;
  rating?: string;
  status?: string;
  page?: number;
};

export async function getCollegeFeedback(
  actor: Parameters<typeof assertCollegeDashboard>[0],
  filters: CollegeFeedbackFilters = {},
) {
  const collegeId = assertCollegeDashboard(actor);
  const college = await prisma.college.findFirst({
    where: { id: collegeId, deletedAt: null },
    select: { id: true, name: true, shortName: true, timezone: true },
  });

  if (!college) {
    throw new TenantIsolationError();
  }

  const clubId =
    filters.clubId && uuidSchema.safeParse(filters.clubId).success ? filters.clubId : "";
  const [clubs, initialEvents] = await Promise.all([
    prisma.club.findMany({
      where: { collegeId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.event.findMany({
      where: {
        collegeId,
        deletedAt: null,
        status: "COMPLETED",
        ...(clubId ? { clubId } : {}),
      },
      select: { id: true, title: true, startsAt: true, club: { select: { name: true } } },
      orderBy: { startsAt: "desc" },
      take: 100,
    }),
  ]);
  let events = initialEvents;

  if (clubId && !clubs.some((club) => club.id === clubId)) {
    throw new TenantIsolationError();
  }

  const selectedEventId =
    filters.eventId && uuidSchema.safeParse(filters.eventId).success ? filters.eventId : "";

  if (selectedEventId && !events.some((event) => event.id === selectedEventId)) {
    const selectedEvent = await prisma.event.findFirst({
      where: {
        id: selectedEventId,
        collegeId,
        deletedAt: null,
        status: "COMPLETED",
        ...(clubId ? { clubId } : {}),
      },
      select: { id: true, title: true, startsAt: true, club: { select: { name: true } } },
    });

    if (!selectedEvent) {
      throw new TenantIsolationError();
    }

    events = [selectedEvent, ...events];
  }

  const rating = ["1", "2", "3", "4", "5"].includes(filters.rating ?? "")
    ? Number(filters.rating)
    : null;
  const status =
    filters.status === "VISIBLE" || filters.status === "HIDDEN" ? filters.status : "ALL";
  const pageSize = 20;
  const requestedPage = Math.max(filters.page ?? 1, 1);

  const where: Prisma.EventFeedbackWhereInput = {
    collegeId,
    ...(selectedEventId ? { eventId: selectedEventId } : {}),
    ...(clubId ? { event: { clubId } } : {}),
    ...(rating ? { rating } : {}),
    ...(status === "ALL" ? {} : { moderationStatus: status }),
  };

  const [total, visibleAggregate, hiddenCount, distribution, eventSummary] = await Promise.all([
    prisma.eventFeedback.count({ where }),
    prisma.eventFeedback.aggregate({
      where: {
        collegeId,
        ...(selectedEventId ? { eventId: selectedEventId } : {}),
        ...(clubId ? { event: { clubId } } : {}),
        moderationStatus: "VISIBLE",
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.eventFeedback.count({
      where: {
        collegeId,
        ...(selectedEventId ? { eventId: selectedEventId } : {}),
        ...(clubId ? { event: { clubId } } : {}),
        moderationStatus: "HIDDEN",
      },
    }),
    prisma.eventFeedback.groupBy({
      by: ["rating"],
      where: {
        collegeId,
        ...(selectedEventId ? { eventId: selectedEventId } : {}),
        ...(clubId ? { event: { clubId } } : {}),
        moderationStatus: "VISIBLE",
      },
      _count: { _all: true },
      orderBy: { rating: "asc" },
    }),
    prisma.eventFeedback.groupBy({
      by: ["eventId"],
      where: {
        collegeId,
        ...(selectedEventId ? { eventId: selectedEventId } : {}),
        ...(clubId ? { event: { clubId } } : {}),
        moderationStatus: "VISIBLE",
      },
      _avg: { rating: true },
      _count: { _all: true },
      orderBy: { eventId: "asc" },
    }),
  ]);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(requestedPage, totalPages);
  const feedback = await prisma.eventFeedback.findMany({
    where,
    include: {
      ...feedbackInclude,
      event: {
        select: { id: true, title: true, startsAt: true, club: { select: { name: true } } },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const eventTitleById = new Map(events.map((event) => [event.id, event.title]));
  const missingEventIds = eventSummary
    .map((row) => row.eventId)
    .filter((eventId) => !eventTitleById.has(eventId));

  if (missingEventIds.length) {
    const missingEvents = await prisma.event.findMany({
      where: { collegeId, id: { in: missingEventIds }, deletedAt: null },
      select: { id: true, title: true },
    });
    for (const event of missingEvents) {
      eventTitleById.set(event.id, event.title);
    }
  }

  const feedbackByEvent = eventSummary
    .map((row) => ({
      eventId: row.eventId,
      title: eventTitleById.get(row.eventId) ?? "Event",
      averageRating: row._avg.rating,
      responseCount: row._count._all,
    }))
    .sort((left, right) => (right.averageRating ?? 0) - (left.averageRating ?? 0));

  return {
    college,
    clubs,
    events,
    feedback,
    total,
    page,
    pageSize,
    totalPages,
    filters: { rating: rating ? String(rating) : "", status, eventId: selectedEventId, clubId },
    summary: {
      averageRating: visibleAggregate._avg.rating,
      responseCount: visibleAggregate._count._all,
      visibleCount: visibleAggregate._count._all,
      hiddenCount,
      distribution: distribution.map((row) => ({ rating: row.rating, count: row._count._all })),
      feedbackByEvent,
    },
  };
}

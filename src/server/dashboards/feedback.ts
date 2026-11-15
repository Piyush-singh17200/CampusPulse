import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import {
  assertClubDashboard,
  assertCollegeDashboard,
  managedClubIds,
} from "@/server/dashboards/access";
import { TenantIsolationError } from "@/server/errors";
import { feedbackWindowClosesAt } from "@/services/feedback";

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

export async function getStudentFeedback(actor: Parameters<typeof assertClubDashboard>[0]) {
  const collegeId = actor.collegeId;

  if (!collegeId) {
    return {
      timezone: "Asia/Kolkata",
      rows: [] as never[],
      counts: { available: 0, submitted: 0 },
    };
  }

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

  if (!profile) {
    return {
      timezone: college?.timezone ?? "Asia/Kolkata",
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
    timezone: college?.timezone ?? "Asia/Kolkata",
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

  const events = await prisma.event.findMany({
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

  const selectedEvent = filters.eventId
    ? (events.find((event) => event.id === filters.eventId) ?? null)
    : (events[0] ?? null);

  if (filters.eventId && !selectedEvent) {
    throw new TenantIsolationError();
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
  const page = Math.max(filters.page ?? 1, 1);

  const where: Prisma.EventFeedbackWhereInput = {
    collegeId,
    eventId: selectedEvent.id,
    ...(rating ? { rating } : {}),
    ...(status === "ALL" ? {} : { moderationStatus: status }),
  };

  const [feedback, total, visibleAggregate, hiddenCount, distribution] = await Promise.all([
    prisma.eventFeedback.findMany({
      where,
      include: feedbackInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
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

  return {
    clubs,
    club,
    events,
    selectedEvent,
    feedback,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
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

  const events = await prisma.event.findMany({
    where: { collegeId, deletedAt: null, status: "COMPLETED" },
    select: { id: true, title: true, startsAt: true, club: { select: { name: true } } },
    orderBy: { startsAt: "desc" },
    take: 100,
  });

  const selectedEventId = filters.eventId ?? "";
  const rating = ["1", "2", "3", "4", "5"].includes(filters.rating ?? "")
    ? Number(filters.rating)
    : null;
  const status =
    filters.status === "VISIBLE" || filters.status === "HIDDEN" ? filters.status : "ALL";
  const pageSize = 20;
  const page = Math.max(filters.page ?? 1, 1);

  const where: Prisma.EventFeedbackWhereInput = {
    collegeId,
    ...(selectedEventId ? { eventId: selectedEventId } : {}),
    ...(rating ? { rating } : {}),
    ...(status === "ALL" ? {} : { moderationStatus: status }),
  };

  const [feedback, total, visibleAggregate, hiddenCount, distribution, eventSummary] =
    await Promise.all([
      prisma.eventFeedback.findMany({
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
      }),
      prisma.eventFeedback.count({ where }),
      prisma.eventFeedback.aggregate({
        where: {
          collegeId,
          ...(selectedEventId ? { eventId: selectedEventId } : {}),
          moderationStatus: "VISIBLE",
        },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.eventFeedback.count({
        where: {
          collegeId,
          ...(selectedEventId ? { eventId: selectedEventId } : {}),
          moderationStatus: "HIDDEN",
        },
      }),
      prisma.eventFeedback.groupBy({
        by: ["rating"],
        where: {
          collegeId,
          ...(selectedEventId ? { eventId: selectedEventId } : {}),
          moderationStatus: "VISIBLE",
        },
        _count: { _all: true },
        orderBy: { rating: "asc" },
      }),
      prisma.eventFeedback.groupBy({
        by: ["eventId"],
        where: { collegeId, moderationStatus: "VISIBLE" },
        _avg: { rating: true },
        _count: { _all: true },
        orderBy: { eventId: "asc" },
      }),
    ]);

  const eventTitleById = new Map(events.map((event) => [event.id, event.title]));
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
    events,
    feedback,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    filters: { rating: rating ? String(rating) : "", status, eventId: selectedEventId },
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

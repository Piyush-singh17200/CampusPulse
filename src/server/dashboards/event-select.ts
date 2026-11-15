import type { Prisma } from "@/generated/prisma/client";

export const eventListSelect = {
  id: true,
  collegeId: true,
  clubId: true,
  title: true,
  slug: true,
  summary: true,
  status: true,
  startsAt: true,
  endsAt: true,
  registrationOpensAt: true,
  registrationDeadline: true,
  venueName: true,
  venueAddress: true,
  isOnline: true,
  onlineUrl: true,
  capacity: true,
  publishedAt: true,
  rejectedAt: true,
  rejectionReason: true,
  cancelledAt: true,
  cancellationReason: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  club: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  },
  categories: {
    select: {
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
  posters: {
    where: { isPrimary: true },
    select: { id: true, mimeType: true, altText: true, width: true, height: true },
    take: 1,
  },
  _count: {
    select: {
      registrations: true,
      duplicatesAsPrimary: { where: { status: "PENDING" } },
      duplicatesAsCandidate: { where: { status: "PENDING" } },
    },
  },
} satisfies Prisma.EventSelect;

export const eventDetailSelect = {
  ...eventListSelect,
  description: true,
  interests: {
    select: {
      interest: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
  club: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      description: true,
    },
  },
} satisfies Prisma.EventSelect;

export type DashboardEvent = Prisma.EventGetPayload<{ select: typeof eventListSelect }>;
export type DashboardEventDetail = Prisma.EventGetPayload<{ select: typeof eventDetailSelect }>;

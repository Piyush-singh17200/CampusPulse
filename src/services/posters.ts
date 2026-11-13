import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { EventStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { runInTransaction } from "@/server/db/transactions";
import { ActorNotAuthorizedError, DomainError, InvalidTransitionError } from "@/server/errors";
import { extensionForMimeType, validatePosterImage } from "@/server/posters/image";
import { getPosterStorage, type PosterStorage } from "@/server/storage/poster-storage";
import {
  assertActorActive,
  assertClubManagerFor,
  isClubManagerFor,
  isSuperAdmin,
  type AuthenticatedActor,
} from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";

const POSTER_MANAGEABLE_STATUSES: ReadonlySet<EventStatus> = new Set([
  "DRAFT",
  "REJECTED",
  "PUBLISHED",
]);

const uploadPosterSchema = z.object({
  eventId: uuidSchema,
  altText: z.string().trim().max(300).nullable().optional(),
});

const removePosterSchema = z.object({
  eventId: uuidSchema,
});

type EventWithClub = Prisma.EventGetPayload<{ include: { club: true } }>;

export type UploadEventPosterInput = {
  eventId: string;
  bytes: Uint8Array;
  altText?: string | null;
};

function assertCanManagePoster(actor: AuthenticatedActor, event: EventWithClub): void {
  if (event.club.status !== "ACTIVE" || event.club.deletedAt) {
    throw new ActorNotAuthorizedError("Posters can only be managed for an active club.");
  }

  assertClubManagerFor(actor, event.clubId, event.collegeId);
}

function assertPosterStatus(event: EventWithClub): void {
  if (!POSTER_MANAGEABLE_STATUSES.has(event.status)) {
    if (event.status === "PENDING_APPROVAL") {
      throw new InvalidTransitionError(
        "Poster changes are locked while the event is under college review.",
      );
    }

    throw new InvalidTransitionError(
      "Poster changes are not available for a cancelled or completed event.",
    );
  }
}

type EventReader = Pick<Prisma.TransactionClient, "event">;

async function loadEvent(client: EventReader, eventId: string): Promise<EventWithClub> {
  const event = await client.event.findUnique({
    where: { id: eventId },
    include: { club: true },
  });

  if (!event || event.deletedAt) {
    throw new DomainError("NOT_FOUND", "The requested event does not exist.", 404);
  }

  return event;
}

async function deleteIfUnreferenced(storageKey: string, storage: PosterStorage): Promise<void> {
  try {
    const references = await prisma.eventPoster.count({ where: { storageKey } });

    if (references === 0) {
      await storage.delete(storageKey);
    }
  } catch {
    // The database no longer points at the old asset. A failed cleanup leaves
    // an orphan file, never a broken poster record.
    console.error("Poster cleanup failed.");
  }
}

/**
 * Uploads a new primary poster. The file is written first, then the database
 * transaction swaps the primary row. If the transaction fails, the new file is
 * removed. If the old file cannot be removed after commit, the old row is gone
 * and the file is an orphan, not a broken reference.
 */
export async function uploadEventPoster(
  actor: AuthenticatedActor,
  input: UploadEventPosterInput,
  storage: PosterStorage = getPosterStorage(),
) {
  assertActorActive(actor);
  const data = parseServiceInput(uploadPosterSchema, {
    eventId: input.eventId,
    altText: input.altText,
  });

  if (!(input.bytes instanceof Uint8Array)) {
    throw new DomainError("INVALID_INPUT", "A poster image is required.", 400);
  }

  const event = await loadEvent(prisma, data.eventId);
  assertCanManagePoster(actor, event);
  assertPosterStatus(event);

  const image = validatePosterImage(input.bytes);
  const storageKey = `${randomUUID()}.${image.extension}`;

  try {
    await storage.put(storageKey, input.bytes);
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }

    throw new DomainError(
      "STORAGE_ERROR",
      "The poster file could not be processed. Please try again.",
      500,
    );
  }

  let result: {
    poster: Prisma.EventPosterGetPayload<object>;
    previousStorageKey: string | null;
  };

  try {
    result = await runInTransaction(prisma, async (tx) => {
      const currentEvent = await loadEvent(tx, data.eventId);
      assertCanManagePoster(actor, currentEvent);
      assertPosterStatus(currentEvent);

      const existing = await tx.eventPoster.findFirst({
        where: {
          eventId: currentEvent.id,
          collegeId: currentEvent.collegeId,
          isPrimary: true,
        },
        select: { id: true, storageKey: true },
      });

      if (existing) {
        await tx.eventPoster.delete({ where: { id: existing.id } });
      }

      const poster = await tx.eventPoster.create({
        data: {
          collegeId: currentEvent.collegeId,
          eventId: currentEvent.id,
          storageKey,
          mimeType: image.mimeType,
          byteSize: image.byteSize,
          width: image.width,
          height: image.height,
          altText: data.altText?.trim() || `${currentEvent.title} poster`,
          isPrimary: true,
        },
      });

      await writeAuditLog(tx, {
        collegeId: currentEvent.collegeId,
        actorUserId: actor.id,
        action: existing ? "POSTER_REPLACED" : "POSTER_UPLOADED",
        entityType: "EventPoster",
        entityId: poster.id,
        metadata: {
          eventId: currentEvent.id,
          clubId: currentEvent.clubId,
          previousPosterId: existing?.id ?? null,
          mimeType: image.mimeType,
          byteSize: image.byteSize,
          width: image.width,
          height: image.height,
        },
      });

      return {
        poster,
        previousStorageKey: existing?.storageKey ?? null,
      };
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }

  if (result.previousStorageKey) {
    await deleteIfUnreferenced(result.previousStorageKey, storage);
  }

  return result.poster;
}

export async function removeEventPoster(
  actor: AuthenticatedActor,
  input: unknown,
  storage: PosterStorage = getPosterStorage(),
) {
  assertActorActive(actor);
  const data = parseServiceInput(removePosterSchema, input);
  const event = await loadEvent(prisma, data.eventId);

  assertCanManagePoster(actor, event);
  assertPosterStatus(event);

  const removed = await runInTransaction(prisma, async (tx) => {
    const currentEvent = await loadEvent(tx, data.eventId);
    assertCanManagePoster(actor, currentEvent);
    assertPosterStatus(currentEvent);

    const existing = await tx.eventPoster.findFirst({
      where: {
        eventId: currentEvent.id,
        collegeId: currentEvent.collegeId,
        isPrimary: true,
      },
      select: { id: true, storageKey: true, mimeType: true, byteSize: true },
    });

    if (!existing) {
      return null;
    }

    await tx.eventPoster.delete({ where: { id: existing.id } });

    await writeAuditLog(tx, {
      collegeId: currentEvent.collegeId,
      actorUserId: actor.id,
      action: "POSTER_REMOVED",
      entityType: "EventPoster",
      entityId: existing.id,
      metadata: {
        eventId: currentEvent.id,
        clubId: currentEvent.clubId,
        mimeType: existing.mimeType,
        byteSize: existing.byteSize,
      },
    });

    return existing;
  });

  if (removed) {
    await deleteIfUnreferenced(removed.storageKey, storage);
  }

  return { removed: Boolean(removed) };
}

/**
 * Resolves a poster for delivery. Missing, cross-tenant, unpublished, and
 * storage-missing assets all resolve to null so the route cannot be used to
 * enumerate private event assets.
 */
export async function getEventPosterForActor(
  actor: AuthenticatedActor,
  posterId: string,
  storage: PosterStorage = getPosterStorage(),
) {
  assertActorActive(actor);

  if (!uuidSchema.safeParse(posterId).success) {
    return null;
  }

  const poster = await prisma.eventPoster.findFirst({
    where: { id: posterId },
    select: {
      id: true,
      storageKey: true,
      mimeType: true,
      altText: true,
      width: true,
      height: true,
      event: {
        select: {
          id: true,
          collegeId: true,
          clubId: true,
          status: true,
          deletedAt: true,
          club: { select: { status: true, deletedAt: true } },
        },
      },
    },
  });

  if (!poster || poster.event.deletedAt) {
    return null;
  }

  const event = poster.event;
  const sameCollege = actor.collegeId === event.collegeId;
  const manager =
    sameCollege && !event.club.deletedAt && isClubManagerFor(actor, event.clubId, event.collegeId);
  const publishedVisible =
    event.status === "PUBLISHED" && event.club.status === "ACTIVE" && !event.club.deletedAt;

  const allowed =
    isSuperAdmin(actor) ||
    (sameCollege && (actor.role === "COLLEGE_ADMIN" || manager || publishedVisible));

  if (!allowed) {
    return null;
  }

  if (!extensionForMimeType(poster.mimeType)) {
    return null;
  }

  const data = await storage.get(poster.storageKey);

  if (!data) {
    return null;
  }

  return {
    id: poster.id,
    mimeType: poster.mimeType,
    altText: poster.altText,
    width: poster.width,
    height: poster.height,
    data,
  };
}

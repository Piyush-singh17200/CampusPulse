import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { createNotifications } from "@/server/db/notifications";
import { isPrismaUniqueConstraintError, runInTransaction } from "@/server/db/transactions";
import {
  ActorNotAuthorizedError,
  DomainError,
  InvalidTransitionError,
  TenantIsolationError,
} from "@/server/errors";
import { assertStudent, type AuthenticatedActor } from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";

export const REGISTRATION_TRANSITIONS: Record<RegistrationStatus, readonly RegistrationStatus[]> = {
  CONFIRMED: ["CANCELLED", "ATTENDED", "NO_SHOW"],
  CANCELLED: ["CONFIRMED"],
  ATTENDED: [],
  NO_SHOW: [],
};

const registerSchema = z.object({
  eventId: uuidSchema,
});

const cancelRegistrationSchema = z.object({
  eventId: uuidSchema,
});

function assertRegistrationTransition(from: RegistrationStatus, to: RegistrationStatus): void {
  if (!REGISTRATION_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(`Registration cannot transition from ${from} to ${to}.`);
  }
}

async function lockEvent(
  tx: Prisma.TransactionClient,
  eventId: string,
  collegeId: string,
): Promise<void> {
  // Parameterized SQL. The row lock is the serialization point for capacity
  // checks: concurrent registrations for the same event cannot both read the
  // active count and then insert beyond capacity.
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "events"
    WHERE "id" = ${eventId}::uuid
      AND "collegeId" = ${collegeId}::uuid
      AND "deletedAt" IS NULL
    FOR UPDATE
  `;

  if (rows.length !== 1) {
    throw new TenantIsolationError();
  }
}

export async function registerForEvent(actor: AuthenticatedActor, input: unknown) {
  assertStudent(actor);
  const data = parseServiceInput(registerSchema, input);

  try {
    return await runInTransaction(prisma, async (tx) => {
      if (!actor.collegeId) {
        throw new ActorNotAuthorizedError("A student profile and college are required.");
      }

      const studentProfile = await tx.studentProfile.findUnique({
        where: {
          userId_collegeId: { userId: actor.id, collegeId: actor.collegeId },
        },
        select: { id: true, collegeId: true },
      });

      if (!studentProfile) {
        throw new ActorNotAuthorizedError("Only students with a profile can register.");
      }

      await lockEvent(tx, data.eventId, studentProfile.collegeId);

      const event = await tx.event.findUnique({
        where: { id: data.eventId },
        select: {
          id: true,
          collegeId: true,
          title: true,
          status: true,
          startsAt: true,
          registrationOpensAt: true,
          registrationDeadline: true,
          capacity: true,
          deletedAt: true,
          club: { select: { status: true } },
        },
      });

      if (!event || event.deletedAt || event.club.status !== "ACTIVE") {
        throw new TenantIsolationError();
      }

      if (event.status !== "PUBLISHED") {
        throw new DomainError(
          "EVENT_NOT_OPEN",
          `Registration is not available for a ${event.status.toLowerCase()} event.`,
          409,
        );
      }

      const now = new Date();

      if (event.startsAt <= now) {
        throw new DomainError("REGISTRATION_CLOSED", "The event has already started.", 409);
      }

      if (event.registrationOpensAt && now < event.registrationOpensAt) {
        throw new DomainError(
          "REGISTRATION_NOT_OPEN",
          "Registration has not opened for this event yet.",
          409,
        );
      }

      if (event.registrationDeadline && now > event.registrationDeadline) {
        throw new DomainError("REGISTRATION_CLOSED", "The registration deadline has passed.", 409);
      }

      const existing = await tx.eventRegistration.findUnique({
        where: {
          eventId_studentProfileId: {
            eventId: event.id,
            studentProfileId: studentProfile.id,
          },
        },
        select: { id: true, status: true },
      });

      if (existing && existing.status !== "CANCELLED") {
        throw new DomainError(
          "ALREADY_REGISTERED",
          "You are already registered for this event.",
          409,
        );
      }

      if (existing) {
        assertRegistrationTransition(existing.status, "CONFIRMED");
      }

      if (event.capacity !== null) {
        const activeCount = await tx.eventRegistration.count({
          where: {
            eventId: event.id,
            collegeId: event.collegeId,
            status: { in: ["CONFIRMED", "ATTENDED"] },
          },
        });

        if (activeCount >= event.capacity) {
          throw new DomainError("EVENT_FULL", "This event has reached capacity.", 409);
        }
      }

      const registration = existing
        ? await tx.eventRegistration.update({
            where: { id: existing.id },
            data: {
              status: "CONFIRMED",
              registeredAt: now,
              cancelledAt: null,
              checkedInAt: null,
            },
          })
        : await tx.eventRegistration.create({
            data: {
              collegeId: event.collegeId,
              eventId: event.id,
              studentProfileId: studentProfile.id,
              status: "CONFIRMED",
              registeredAt: now,
            },
          });

      await createNotifications(tx, [
        {
          collegeId: event.collegeId,
          userId: actor.id,
          type: "REGISTRATION_UPDATE",
          title: "Registration confirmed",
          body: `You are registered for "${event.title}".`,
          actionUrl: `/student/events/${event.id}`,
        },
      ]);

      await writeAuditLog(tx, {
        collegeId: event.collegeId,
        actorUserId: actor.id,
        action: "REGISTRATION_STATUS_CHANGED",
        entityType: "EventRegistration",
        entityId: registration.id,
        metadata: {
          eventId: event.id,
          from: existing?.status ?? null,
          to: "CONFIRMED",
        },
      });

      return registration;
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new DomainError(
        "ALREADY_REGISTERED",
        "You are already registered for this event.",
        409,
      );
    }

    throw error;
  }
}

export async function cancelRegistration(actor: AuthenticatedActor, input: unknown) {
  assertStudent(actor);
  const data = parseServiceInput(cancelRegistrationSchema, input);

  return runInTransaction(prisma, async (tx) => {
    if (!actor.collegeId) {
      throw new ActorNotAuthorizedError("A student profile and college are required.");
    }

    const studentProfile = await tx.studentProfile.findUnique({
      where: {
        userId_collegeId: { userId: actor.id, collegeId: actor.collegeId },
      },
      select: { id: true, collegeId: true },
    });

    if (!studentProfile) {
      throw new ActorNotAuthorizedError("Only students with a profile can cancel a registration.");
    }

    const registration = await tx.eventRegistration.findUnique({
      where: {
        eventId_studentProfileId: {
          eventId: data.eventId,
          studentProfileId: studentProfile.id,
        },
      },
      select: {
        id: true,
        status: true,
        collegeId: true,
        event: { select: { id: true, title: true } },
      },
    });

    if (!registration || registration.collegeId !== studentProfile.collegeId) {
      throw new DomainError("NOT_REGISTERED", "No registration exists for this event.", 404);
    }

    assertRegistrationTransition(registration.status, "CANCELLED");

    const result = await tx.eventRegistration.updateMany({
      where: {
        id: registration.id,
        collegeId: registration.collegeId,
        status: registration.status,
      },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    if (result.count !== 1) {
      throw new DomainError("CONFLICT", "The registration changed while it was cancelled.", 409);
    }

    await createNotifications(tx, [
      {
        collegeId: registration.collegeId,
        userId: actor.id,
        type: "REGISTRATION_UPDATE",
        title: "Registration cancelled",
        body: `Your registration for "${registration.event.title}" was cancelled.`,
        actionUrl: `/student/events/${registration.event.id}`,
      },
    ]);

    await writeAuditLog(tx, {
      collegeId: registration.collegeId,
      actorUserId: actor.id,
      action: "REGISTRATION_STATUS_CHANGED",
      entityType: "EventRegistration",
      entityId: registration.id,
      metadata: {
        eventId: data.eventId,
        from: registration.status,
        to: "CANCELLED",
      },
    });

    return tx.eventRegistration.findUniqueOrThrow({ where: { id: registration.id } });
  });
}

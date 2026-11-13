import "server-only";

import { z } from "zod";

import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { runInTransaction } from "@/server/db/transactions";
import {
  ActorNotAuthorizedError,
  DomainError,
  InvalidTransitionError,
  TenantIsolationError,
} from "@/server/errors";
import {
  assertActorActive,
  isClubManagerFor,
  isSuperAdmin,
  type AuthenticatedActor,
} from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";
import { REGISTRATION_TRANSITIONS } from "@/services/registrations";

const attendanceSchema = z.object({
  registrationId: uuidSchema,
  status: z.enum(["ATTENDED", "NO_SHOW"]),
});

/**
 * Attendance is deliberately limited to the existing EventRegistration status
 * model. There is no QR scanner or check-in token yet; this service records the
 * final attendance state after an event has started.
 */
export async function markAttendance(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(attendanceSchema, input);

  return runInTransaction(prisma, async (tx) => {
    const registration = await tx.eventRegistration.findUnique({
      where: { id: data.registrationId },
      include: {
        event: {
          select: {
            id: true,
            collegeId: true,
            status: true,
            startsAt: true,
            clubId: true,
            club: { select: { status: true, deletedAt: true } },
          },
        },
        studentProfile: {
          select: {
            id: true,
            rollNumber: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!registration || registration.collegeId !== registration.event.collegeId) {
      throw new TenantIsolationError();
    }

    const canManage =
      isSuperAdmin(actor) ||
      (actor.role === "COLLEGE_ADMIN" && actor.collegeId === registration.event.collegeId) ||
      (registration.event.club.status === "ACTIVE" &&
        !registration.event.club.deletedAt &&
        isClubManagerFor(actor, registration.event.clubId, registration.event.collegeId));

    if (!canManage) {
      throw new ActorNotAuthorizedError(
        "You are not authorized to manage this event's attendance.",
      );
    }

    if (!["PUBLISHED", "COMPLETED"].includes(registration.event.status)) {
      throw new InvalidTransitionError("Attendance is only available for published events.");
    }

    if (registration.event.startsAt > new Date()) {
      throw new InvalidTransitionError("Attendance cannot be recorded before the event starts.");
    }

    if (!REGISTRATION_TRANSITIONS[registration.status].includes(data.status)) {
      throw new InvalidTransitionError(
        `Attendance cannot change from ${registration.status} to ${data.status}.`,
      );
    }

    const result = await tx.eventRegistration.updateMany({
      where: {
        id: registration.id,
        collegeId: registration.collegeId,
        status: registration.status,
      },
      data: {
        status: data.status,
        checkedInAt: data.status === "ATTENDED" ? new Date() : null,
      },
    });

    if (result.count !== 1) {
      throw new DomainError(
        "CONFLICT",
        "The registration changed while attendance was recorded.",
        409,
      );
    }

    await writeAuditLog(tx, {
      collegeId: registration.collegeId,
      actorUserId: actor.id,
      action: "REGISTRATION_STATUS_CHANGED",
      entityType: "EventRegistration",
      entityId: registration.id,
      metadata: {
        eventId: registration.eventId,
        studentName: registration.studentProfile.user.name,
        from: registration.status,
        to: data.status,
      },
    });

    return tx.eventRegistration.findUniqueOrThrow({ where: { id: registration.id } });
  });
}

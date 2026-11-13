import "server-only";

import { z } from "zod";

import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { runInTransaction } from "@/server/db/transactions";
import { ActorNotAuthorizedError, DomainError } from "@/server/errors";
import { assertActorActive, type AuthenticatedActor } from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";

const notificationSchema = z.object({
  notificationId: uuidSchema,
});

async function notificationScope(actor: AuthenticatedActor) {
  assertActorActive(actor);

  if (!actor.collegeId) {
    throw new ActorNotAuthorizedError("A college context is required for notifications.");
  }

  return { userId: actor.id, collegeId: actor.collegeId };
}

export async function markNotificationRead(actor: AuthenticatedActor, input: unknown) {
  const data = parseServiceInput(notificationSchema, input);
  const scope = await notificationScope(actor);

  return runInTransaction(prisma, async (tx) => {
    const notification = await tx.notification.findFirst({
      where: {
        id: data.notificationId,
        userId: scope.userId,
        collegeId: scope.collegeId,
      },
      select: { id: true, readAt: true },
    });

    if (!notification) {
      throw new DomainError("NOT_FOUND", "The requested notification does not exist.", 404);
    }

    if (notification.readAt) {
      return notification;
    }

    const updated = await tx.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });

    await writeAuditLog(tx, {
      collegeId: scope.collegeId,
      actorUserId: actor.id,
      action: "NOTIFICATION_READ",
      entityType: "Notification",
      entityId: notification.id,
      metadata: {},
    });

    return updated;
  });
}

export async function markAllNotificationsRead(actor: AuthenticatedActor) {
  const scope = await notificationScope(actor);

  return runInTransaction(prisma, async (tx) => {
    const result = await tx.notification.updateMany({
      where: { userId: scope.userId, collegeId: scope.collegeId, readAt: null },
      data: { readAt: new Date() },
    });

    if (result.count > 0) {
      await writeAuditLog(tx, {
        collegeId: scope.collegeId,
        actorUserId: actor.id,
        action: "NOTIFICATION_READ",
        entityType: "Notification",
        entityId: scope.userId,
        metadata: { count: result.count, all: true },
      });
    }

    return result.count;
  });
}

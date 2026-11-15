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

const preferenceSchema = z.object({
  registrationUpdates: z.boolean(),
  attendanceUpdates: z.boolean(),
  feedbackUpdates: z.boolean(),
});

export type NotificationPreferenceView = {
  registrationUpdates: boolean;
  attendanceUpdates: boolean;
  feedbackUpdates: boolean;
};

export const defaultNotificationPreferences: NotificationPreferenceView = {
  registrationUpdates: true,
  attendanceUpdates: true,
  feedbackUpdates: true,
};

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

export async function getNotificationPreferences(
  actor: AuthenticatedActor,
): Promise<NotificationPreferenceView> {
  const scope = await notificationScope(actor);
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: scope.userId },
    select: {
      registrationUpdates: true,
      attendanceUpdates: true,
      feedbackUpdates: true,
    },
  });

  return preference ?? defaultNotificationPreferences;
}

export async function updateNotificationPreferences(
  actor: AuthenticatedActor,
  input: unknown,
): Promise<NotificationPreferenceView> {
  const data = parseServiceInput(preferenceSchema, input);
  const scope = await notificationScope(actor);

  return runInTransaction(prisma, async (tx) => {
    const preference = await tx.notificationPreference.upsert({
      where: { userId: scope.userId },
      create: {
        collegeId: scope.collegeId,
        userId: scope.userId,
        ...data,
      },
      update: data,
      select: {
        registrationUpdates: true,
        attendanceUpdates: true,
        feedbackUpdates: true,
      },
    });

    await writeAuditLog(tx, {
      collegeId: scope.collegeId,
      actorUserId: actor.id,
      action: "NOTIFICATION_PREFERENCES_UPDATED",
      entityType: "NotificationPreference",
      entityId: scope.userId,
      metadata: { ...data },
    });

    return preference;
  });
}

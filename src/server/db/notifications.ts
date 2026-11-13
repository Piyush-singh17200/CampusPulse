import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { NotificationType } from "@/generated/prisma/enums";

export type NotificationInput = {
  collegeId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string | null;
};

/**
 * Notification rows are written inside the same database transaction as the
 * state change they describe. A rolled-back transition therefore cannot leave
 * a notification claiming that it happened.
 */
export async function createNotifications(
  tx: Prisma.TransactionClient,
  notifications: NotificationInput[],
): Promise<void> {
  if (notifications.length === 0) {
    return;
  }

  await tx.notification.createMany({ data: notifications });
}

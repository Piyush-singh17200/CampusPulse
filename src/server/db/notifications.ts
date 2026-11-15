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

type PreferenceKey = "registrationUpdates" | "attendanceUpdates" | "feedbackUpdates";

const OPTIONAL_TYPE_PREFERENCE: Partial<Record<NotificationType, PreferenceKey>> = {
  REGISTRATION_UPDATE: "registrationUpdates",
  ATTENDANCE_UPDATE: "attendanceUpdates",
  FEEDBACK_UPDATE: "feedbackUpdates",
};

/**
 * Notification rows are written inside the same database transaction as the
 * state change they describe. Optional in-app categories are filtered against
 * the user's preference row (or the default-enabled state when no row exists).
 * There is no email, SMS, or push delivery in this path.
 */
export async function createNotifications(
  tx: Prisma.TransactionClient,
  notifications: NotificationInput[],
): Promise<void> {
  if (notifications.length === 0) {
    return;
  }

  const optionalUserIds = [
    ...new Set(
      notifications
        .filter((notification) => OPTIONAL_TYPE_PREFERENCE[notification.type])
        .map((notification) => notification.userId),
    ),
  ];

  const preferences =
    optionalUserIds.length > 0
      ? await tx.notificationPreference.findMany({
          where: { userId: { in: optionalUserIds } },
          select: {
            userId: true,
            registrationUpdates: true,
            attendanceUpdates: true,
            feedbackUpdates: true,
          },
        })
      : [];

  const preferenceByUserId = new Map(
    preferences.map((preference) => [preference.userId, preference]),
  );

  const allowed = notifications.filter((notification) => {
    const preferenceKey = OPTIONAL_TYPE_PREFERENCE[notification.type];
    if (!preferenceKey) {
      return true;
    }

    const preference = preferenceByUserId.get(notification.userId);
    return preference ? preference[preferenceKey] : true;
  });

  if (allowed.length === 0) {
    return;
  }

  await tx.notification.createMany({ data: allowed });
}

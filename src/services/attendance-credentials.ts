import "server-only";

import type { Prisma } from "@/generated/prisma/client";

export async function revokeAttendanceCredentialsForRegistration(
  tx: Prisma.TransactionClient,
  registrationId: string,
  collegeId: string,
): Promise<void> {
  await tx.attendanceCredential.updateMany({
    where: { registrationId, collegeId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAttendanceCredentialsForEvent(
  tx: Prisma.TransactionClient,
  eventId: string,
  collegeId: string,
): Promise<void> {
  await tx.attendanceCredential.updateMany({
    where: { eventId, collegeId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

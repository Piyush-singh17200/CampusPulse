import "server-only";

import type { Prisma } from "@/generated/prisma/client";

type SessionWriter = Pick<Prisma.TransactionClient, "session">;

export async function revokeAllSessionsForUser(tx: SessionWriter, userId: string): Promise<number> {
  const result = await tx.session.deleteMany({ where: { userId } });
  return result.count;
}

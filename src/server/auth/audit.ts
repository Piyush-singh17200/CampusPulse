import type { Prisma } from "@/generated/prisma/client";
import type { AuthAuditEventType } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";
import { redactAuditMetadata } from "@/server/db/audit";

import { hashEmail } from "./request-context";
import { sanitizeUserAgent } from "./request-context";

export type AuthAuditInput = {
  userId?: string | null;
  collegeId?: string | null;
  event: AuthAuditEventType;
  email?: string;
  emailHash?: string;
  ipHash?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

function buildData(input: AuthAuditInput): Prisma.AuthAuditEventCreateInput {
  return {
    user: input.userId ? { connect: { id: input.userId } } : undefined,
    college: input.collegeId ? { connect: { id: input.collegeId } } : undefined,
    event: input.event,
    emailHash: input.email ? hashEmail(input.email) : (input.emailHash ?? null),
    ipHash: input.ipHash ?? null,
    userAgent: sanitizeUserAgent(input.userAgent ?? null) ?? null,
    metadata: (redactAuditMetadata(input.metadata ?? {}) ?? {}) as Prisma.InputJsonValue,
  };
}

export async function writeAuthAuditEvent(
  tx: Prisma.TransactionClient,
  input: AuthAuditInput,
): Promise<void> {
  await tx.authAuditEvent.create({ data: buildData(input) });
}

export async function recordAuthAuditEvent(input: AuthAuditInput): Promise<void> {
  await prisma.authAuditEvent.create({ data: buildData(input) });
}

import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction } from "@/generated/prisma/enums";

export type AuditMetadata = Record<string, unknown>;

export type AuditInput = {
  collegeId?: string | null;
  actorUserId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: AuditMetadata;
};

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|authorization|cookie|api[_-]?key|credential|session)/i;

const MAX_DEPTH = 5;
const MAX_KEYS = 50;
const MAX_STRING_LENGTH = 500;

/**
 * Audit metadata is deliberately small and structural. It must never contain
 * passwords, session material, authorization headers, or raw request bodies.
 * Values are also bounded so an accidental large payload cannot become a
 * secondary data store.
 */
export function redactAuditMetadata(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return "[redacted: max depth]";
  }

  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => redactAuditMetadata(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, MAX_KEYS)
        .map(([key, item]) => [
          key,
          SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redactAuditMetadata(item, depth + 1),
        ]),
    );
  }

  return String(value);
}

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  input: AuditInput,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      collegeId: input.collegeId ?? null,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: (redactAuditMetadata(input.metadata ?? {}) ?? {}) as Prisma.InputJsonValue,
    },
  });
}

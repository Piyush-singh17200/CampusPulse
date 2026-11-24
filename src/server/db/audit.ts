import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/client";

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
  await tx.auditLog.create({ data: auditRow(input) });
}

/**
 * Writes an audit row outside an existing transaction. Used by read-only
 * download routes that must record accountability without mutating domain
 * state. Callers that require the audit and the mutation to commit together
 * must use `writeAuditLog` with their transaction client instead.
 */
export async function recordAuditEvent(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({ data: auditRow(input) });
}

function auditRow(input: AuditInput): Prisma.AuditLogCreateInput {
  return {
    college: input.collegeId ? { connect: { id: input.collegeId } } : undefined,
    actor: { connect: { id: input.actorUserId } },
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: (redactAuditMetadata(input.metadata ?? {}) ?? {}) as Prisma.InputJsonValue,
  };
}

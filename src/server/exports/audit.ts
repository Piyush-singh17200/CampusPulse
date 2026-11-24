import "server-only";

import type { AuthenticatedActor } from "@/server/auth/types";
import { recordAuditEvent } from "@/server/db/audit";

export type ExportKind =
  | "club-analytics"
  | "club-attendance"
  | "college-analytics"
  | "platform-analytics"
  | "calendar-event"
  | "calendar-registered"
  | "calendar-saved";

export type ExportAuditInput = {
  kind: ExportKind;
  /**
   * Stable scope identifier for the export. For event-scoped exports this is
   * the event ID; for collection exports it is a short stable scope label.
   * Never put a filename, student name, or other personal data here.
   */
  scope: string;
  rowCount?: number;
  /** True when the export hit its documented row cap and omitted later rows. */
  truncated?: boolean;
  format: "csv" | "ics";
};

/**
 * Records a sensitive download. The audit row deliberately stores only the
 * export kind, tenant, scope, format, and row count. Student names, roll
 * numbers, departments, and file contents must never enter audit metadata.
 */
export async function recordExportAudit(
  actor: AuthenticatedActor,
  input: ExportAuditInput,
): Promise<void> {
  await recordAuditEvent({
    collegeId: actor.collegeId,
    actorUserId: actor.id,
    action: "EXPORT_DOWNLOADED",
    entityType: "Export",
    entityId: `${input.kind}:${input.scope}`.slice(0, 120),
    metadata: {
      kind: input.kind,
      format: input.format,
      scope: input.scope,
      ...(typeof input.rowCount === "number" ? { rowCount: input.rowCount } : {}),
      ...(input.truncated ? { truncated: true } : {}),
    },
  });
}

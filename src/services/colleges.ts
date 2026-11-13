import "server-only";

import { z } from "zod";

import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { runInTransaction } from "@/server/db/transactions";
import { writeAuthAuditEvent } from "@/server/auth/audit";
import { ActorNotAuthorizedError, DomainError, InvalidInputError } from "@/server/errors";
import {
  assertActorActive,
  assertCollegeAdmin,
  assertSuperAdmin,
  type AuthenticatedActor,
} from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";

const updateCollegeSettingsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  shortName: z.string().trim().max(48).nullable().optional(),
  timezone: z.string().trim().min(1).max(64),
});

const changeCollegeStatusSchema = z.object({
  collegeId: uuidSchema,
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]),
});

function assertTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
  } catch {
    throw new InvalidInputError("Choose a valid IANA timezone.");
  }
}

export async function updateCollegeSettings(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);

  if (!actor.collegeId) {
    throw new ActorNotAuthorizedError("A college administrator college context is required.");
  }

  assertCollegeAdmin(actor, actor.collegeId);
  const data = parseServiceInput(updateCollegeSettingsSchema, input);
  assertTimezone(data.timezone);

  return runInTransaction(prisma, async (tx) => {
    const college = await tx.college.findFirst({
      where: { id: actor.collegeId!, deletedAt: null },
      select: { id: true, name: true, shortName: true, timezone: true },
    });

    if (!college) {
      throw new DomainError("NOT_FOUND", "The requested college does not exist.", 404);
    }

    const shortName = data.shortName?.trim() ? data.shortName.trim() : null;

    const updated = await tx.college.update({
      where: { id: college.id },
      data: {
        name: data.name,
        shortName,
        timezone: data.timezone,
      },
      select: { id: true, name: true, shortName: true, timezone: true, status: true },
    });

    await writeAuditLog(tx, {
      collegeId: college.id,
      actorUserId: actor.id,
      action: "COLLEGE_UPDATED",
      entityType: "College",
      entityId: college.id,
      metadata: {
        changedFields: [
          ...(college.name !== data.name ? ["name"] : []),
          ...(college.shortName !== shortName ? ["shortName"] : []),
          ...(college.timezone !== data.timezone ? ["timezone"] : []),
        ],
      },
    });

    return updated;
  });
}

/**
 * College lifecycle is a platform-only action. Suspending or archiving a
 * college revokes every active session for its users so a stale cookie cannot
 * keep a suspended tenant open.
 */
export async function changeCollegeStatus(actor: AuthenticatedActor, input: unknown) {
  assertSuperAdmin(actor);
  const data = parseServiceInput(changeCollegeStatusSchema, input);

  return runInTransaction(prisma, async (tx) => {
    const college = await tx.college.findFirst({
      where: { id: data.collegeId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!college) {
      throw new DomainError("NOT_FOUND", "The requested college does not exist.", 404);
    }

    if (college.status === data.status) {
      return college;
    }

    const updated = await tx.college.update({
      where: { id: college.id },
      data: { status: data.status },
      select: { id: true, name: true, status: true },
    });

    let revokedCount = 0;

    if (data.status !== "ACTIVE") {
      const revoked = await tx.session.deleteMany({
        where: { user: { collegeId: college.id } },
      });
      revokedCount = revoked.count;
    }

    await writeAuditLog(tx, {
      collegeId: college.id,
      actorUserId: actor.id,
      action: "COLLEGE_UPDATED",
      entityType: "College",
      entityId: college.id,
      metadata: {
        from: college.status,
        to: data.status,
        revokedCount,
      },
    });

    if (revokedCount > 0) {
      await writeAuthAuditEvent(tx, {
        collegeId: college.id,
        event: "SESSION_REVOKED",
        metadata: {
          reason: "college_status_changed",
          fromStatus: college.status,
          toStatus: data.status,
          revokedCount,
        },
      });
    }

    return updated;
  });
}

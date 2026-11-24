import "server-only";

import QRCode from "qrcode";
import { z } from "zod";

import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { createNotifications } from "@/server/db/notifications";
import { runInTransaction } from "@/server/db/transactions";
import {
  ActorNotAuthorizedError,
  DomainError,
  InvalidTransitionError,
  TenantIsolationError,
} from "@/server/errors";
import {
  assertActorActive,
  assertStudent,
  isClubManagerFor,
  isSuperAdmin,
  type AuthenticatedActor,
} from "@/services/authorization";
import { revokeAttendanceCredentialsForRegistration } from "@/services/attendance-credentials";
import {
  attendanceTokenHash,
  createAttendanceToken,
  parseAttendanceToken,
} from "@/lib/attendance-token";
import { parseServiceInput, uuidSchema } from "@/services/validation";
import { REGISTRATION_TRANSITIONS } from "@/services/registrations";

const CHECK_IN_OPENS_BEFORE_MS = 2 * 60 * 60 * 1000;
const CHECK_IN_CLOSES_AFTER_MS = 2 * 60 * 60 * 1000;

const attendanceSchema = z.object({
  registrationId: uuidSchema,
  status: z.enum(["ATTENDED", "NO_SHOW"]),
});

const correctionSchema = z.object({
  registrationId: uuidSchema,
  status: z.enum(["ATTENDED", "NO_SHOW"]),
  reason: z
    .string()
    .trim()
    .min(3, "Provide a short reason for the attendance correction.")
    .max(500, "The reason must be 500 characters or fewer."),
});

const scanSchema = z.object({
  eventId: uuidSchema,
  token: z.string().trim().min(1, "An attendance code is required.").max(256),
});

export function attendanceWindow(startsAt: Date, endsAt: Date) {
  return {
    opensAt: new Date(startsAt.getTime() - CHECK_IN_OPENS_BEFORE_MS),
    closesAt: new Date(endsAt.getTime() + CHECK_IN_CLOSES_AFTER_MS),
  };
}

export function isAttendanceWindowOpen(startsAt: Date, endsAt: Date, now = new Date()): boolean {
  const window = attendanceWindow(startsAt, endsAt);
  return now >= window.opensAt && now <= window.closesAt;
}

/** Manual attendance corrections are allowed only after the event has started. */
export function hasEventStarted(startsAt: Date, now = new Date()): boolean {
  return startsAt <= now;
}

function assertCanManageEventAttendance(
  actor: AuthenticatedActor,
  event: {
    collegeId: string;
    clubId: string;
    club: { status: string; deletedAt: Date | null };
  },
): void {
  const canManage =
    isSuperAdmin(actor) ||
    (actor.role === "COLLEGE_ADMIN" && actor.collegeId === event.collegeId) ||
    (event.club.status === "ACTIVE" &&
      !event.club.deletedAt &&
      isClubManagerFor(actor, event.clubId, event.collegeId));

  if (!canManage) {
    throw new ActorNotAuthorizedError("You are not authorized to manage this event's attendance.");
  }
}

export async function getStudentAttendanceView(actor: AuthenticatedActor, registrationId: string) {
  assertStudent(actor);

  if (!actor.collegeId) {
    throw new ActorNotAuthorizedError("A student college context is required.");
  }

  const [profile, college] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { userId_collegeId: { userId: actor.id, collegeId: actor.collegeId } },
      select: { id: true, collegeId: true },
    }),
    prisma.college.findFirst({
      where: { id: actor.collegeId, deletedAt: null },
      select: { timezone: true },
    }),
  ]);

  if (!profile) {
    throw new ActorNotAuthorizedError("A student profile is required for attendance.");
  }

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      id: registrationId,
      collegeId: profile.collegeId,
      studentProfileId: profile.id,
    },
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      event: {
        select: {
          id: true,
          title: true,
          summary: true,
          startsAt: true,
          endsAt: true,
          venueName: true,
          venueAddress: true,
          isOnline: true,
          onlineUrl: true,
          status: true,
          club: { select: { name: true, status: true, deletedAt: true } },
        },
      },
    },
  });

  if (!registration) {
    return null;
  }

  const now = new Date();
  const window = attendanceWindow(registration.event.startsAt, registration.event.endsAt);
  let reason: string | null = null;

  if (registration.status === "CANCELLED") {
    reason = "This registration was cancelled, so attendance is unavailable.";
  } else if (registration.status === "ATTENDED") {
    reason = "Attendance has already been recorded.";
  } else if (registration.status === "NO_SHOW") {
    reason = "This registration was marked as a no-show by an organizer.";
  } else if (registration.event.status === "CANCELLED") {
    reason = "This event was cancelled.";
  } else if (registration.event.status !== "PUBLISHED") {
    reason = "Attendance is available only while the event is published.";
  } else if (registration.event.club.status !== "ACTIVE" || registration.event.club.deletedAt) {
    reason = "The organizing club is not active.";
  } else if (now < window.opensAt) {
    reason = "Check-in opens two hours before the event starts.";
  } else if (now > window.closesAt) {
    reason = "Check-in has closed for this event.";
  }

  return {
    registration,
    event: registration.event,
    timezone: college?.timezone ?? "Asia/Kolkata",
    window,
    canIssue: reason === null,
    reason,
    attendanceRecorded: registration.status === "ATTENDED",
  };
}

export async function issueAttendanceQr(actor: AuthenticatedActor, registrationId: string) {
  assertStudent(actor);

  if (!actor.collegeId) {
    throw new ActorNotAuthorizedError("A student college context is required.");
  }

  const issued = await runInTransaction(prisma, async (tx) => {
    const profile = await tx.studentProfile.findUnique({
      where: { userId_collegeId: { userId: actor.id, collegeId: actor.collegeId! } },
      select: { id: true, collegeId: true },
    });

    if (!profile) {
      throw new ActorNotAuthorizedError("A student profile is required for attendance.");
    }

    const registration = await tx.eventRegistration.findFirst({
      where: {
        id: registrationId,
        collegeId: profile.collegeId,
        studentProfileId: profile.id,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            status: true,
            clubId: true,
            club: { select: { name: true, status: true, deletedAt: true } },
          },
        },
        attendanceCredential: { select: { usedAt: true, revokedAt: true } },
      },
    });

    if (!registration) {
      throw new DomainError("NOT_FOUND", "The requested registration does not exist.", 404);
    }

    if (registration.status === "CANCELLED") {
      throw new InvalidTransitionError("Attendance is unavailable for a cancelled registration.");
    }
    if (registration.status === "ATTENDED") {
      throw new DomainError("CONFLICT", "Attendance has already been recorded.", 409);
    }
    if (registration.status === "NO_SHOW") {
      throw new InvalidTransitionError("This registration was marked as a no-show.");
    }
    if (registration.event.status !== "PUBLISHED") {
      throw new InvalidTransitionError("Attendance is unavailable for this event.");
    }
    if (registration.event.club.status !== "ACTIVE" || registration.event.club.deletedAt) {
      throw new InvalidTransitionError("The organizing club is not active.");
    }

    const now = new Date();
    const window = attendanceWindow(registration.event.startsAt, registration.event.endsAt);
    if (now < window.opensAt || now > window.closesAt) {
      throw new InvalidTransitionError(
        "Check-in is open from two hours before the event until two hours after it ends.",
      );
    }

    if (registration.attendanceCredential?.usedAt) {
      throw new DomainError("CONFLICT", "This attendance code has already been used.", 409);
    }

    const token = createAttendanceToken();
    const credential = await tx.attendanceCredential.upsert({
      where: { registrationId: registration.id },
      create: {
        collegeId: registration.collegeId,
        eventId: registration.eventId,
        registrationId: registration.id,
        tokenHash: token.tokenHash,
        expiresAt: window.closesAt,
      },
      update: {
        tokenHash: token.tokenHash,
        expiresAt: window.closesAt,
        usedAt: null,
        revokedAt: null,
      },
      select: { id: true, expiresAt: true },
    });

    await writeAuditLog(tx, {
      collegeId: registration.collegeId,
      actorUserId: actor.id,
      action: "ATTENDANCE_CREDENTIAL_ISSUED",
      entityType: "AttendanceCredential",
      entityId: credential.id,
      metadata: {
        eventId: registration.eventId,
        registrationId: registration.id,
        expiresAt: credential.expiresAt,
      },
    });

    return {
      payload: token.payload,
      expiresAt: credential.expiresAt,
      event: registration.event,
    };
  });

  const qrDataUrl = await QRCode.toDataURL(issued.payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: { dark: "#143d31", light: "#fffdf8" },
  });

  return {
    qrDataUrl,
    payload: issued.payload,
    expiresAt: issued.expiresAt,
    event: issued.event,
  };
}

export async function scanAttendance(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(scanSchema, input);
  const token = parseAttendanceToken(data.token);

  if (!token) {
    throw new DomainError("INVALID_INPUT", "Enter a valid CampusPulse attendance code.", 422);
  }

  return runInTransaction(prisma, async (tx) => {
    const credential = await tx.attendanceCredential.findUnique({
      where: { tokenHash: attendanceTokenHash(token) },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            collegeId: true,
            clubId: true,
            status: true,
            startsAt: true,
            endsAt: true,
            club: { select: { status: true, deletedAt: true } },
          },
        },
        registration: {
          include: {
            studentProfile: {
              select: {
                rollNumber: true,
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!credential) {
      throw new DomainError("NOT_FOUND", "This attendance code is not valid.", 404);
    }

    if (credential.collegeId !== credential.event.collegeId) {
      throw new TenantIsolationError();
    }

    assertCanManageEventAttendance(actor, credential.event);

    if (credential.eventId !== data.eventId) {
      throw new InvalidTransitionError("This attendance code is not valid for the selected event.");
    }

    const now = new Date();
    const window = attendanceWindow(credential.event.startsAt, credential.event.endsAt);

    if (credential.event.status !== "PUBLISHED") {
      throw new InvalidTransitionError("Check-in is only available for published events.");
    }
    if (now < window.opensAt || now > window.closesAt) {
      throw new InvalidTransitionError("Check-in is not open for this event.");
    }
    if (credential.revokedAt) {
      throw new InvalidTransitionError("This attendance code has been revoked.");
    }
    if (credential.usedAt) {
      throw new DomainError("CONFLICT", "This attendance code has already been used.", 409);
    }
    if (credential.expiresAt <= now) {
      throw new InvalidTransitionError("This attendance code has expired.");
    }
    if (credential.registration.status === "CANCELLED") {
      throw new InvalidTransitionError("This registration was cancelled.");
    }
    if (credential.registration.status === "ATTENDED") {
      throw new DomainError(
        "CONFLICT",
        "Attendance has already been recorded for this student.",
        409,
      );
    }
    if (credential.registration.status !== "CONFIRMED") {
      throw new InvalidTransitionError("Attendance cannot be recorded for this registration.");
    }

    const claimed = await tx.attendanceCredential.updateMany({
      where: {
        id: credential.id,
        eventId: data.eventId,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (claimed.count !== 1) {
      throw new DomainError("CONFLICT", "This attendance code has already been used.", 409);
    }

    const recorded = await tx.eventRegistration.updateMany({
      where: {
        id: credential.registrationId,
        collegeId: credential.collegeId,
        eventId: credential.eventId,
        status: "CONFIRMED",
      },
      data: { status: "ATTENDED", checkedInAt: now },
    });

    if (recorded.count !== 1) {
      throw new DomainError("CONFLICT", "Attendance was recorded by another check-in.", 409);
    }

    await createNotifications(tx, [
      {
        collegeId: credential.collegeId,
        userId: credential.registration.studentProfile.user.id,
        type: "ATTENDANCE_UPDATE",
        title: "Attendance recorded",
        body: `Your attendance for "${credential.event.title}" was recorded.`,
        actionUrl: "/student/registrations",
      },
    ]);

    await writeAuditLog(tx, {
      collegeId: credential.collegeId,
      actorUserId: actor.id,
      action: "ATTENDANCE_RECORDED",
      entityType: "EventRegistration",
      entityId: credential.registrationId,
      metadata: {
        eventId: credential.eventId,
        registrationId: credential.registrationId,
        studentName: credential.registration.studentProfile.user.name,
        method: "QR",
        checkedInAt: now,
      },
    });

    return {
      studentName: credential.registration.studentProfile.user.name,
      rollNumber: credential.registration.studentProfile.rollNumber,
      eventTitle: credential.event.title,
      checkedInAt: now,
    };
  });
}

/**
 * Authorized manual correction. Unlike the legacy markAttendance helper, this
 * permits ATTENDED <-> NO_SHOW corrections, requires a reason, revokes any
 * outstanding QR credential, and writes an explicit correction audit record.
 */
export async function correctAttendance(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(correctionSchema, input);

  return runInTransaction(prisma, async (tx) => {
    const registration = await tx.eventRegistration.findUnique({
      where: { id: data.registrationId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            collegeId: true,
            status: true,
            startsAt: true,
            clubId: true,
            club: { select: { status: true, deletedAt: true } },
          },
        },
        studentProfile: {
          select: {
            id: true,
            rollNumber: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!registration || registration.collegeId !== registration.event.collegeId) {
      throw new TenantIsolationError();
    }

    assertCanManageEventAttendance(actor, registration.event);

    if (!["PUBLISHED", "COMPLETED"].includes(registration.event.status)) {
      throw new InvalidTransitionError("Attendance is only available for published events.");
    }
    if (!hasEventStarted(registration.event.startsAt)) {
      throw new InvalidTransitionError("Attendance cannot be recorded before the event starts.");
    }
    if (registration.status === "CANCELLED") {
      throw new InvalidTransitionError(
        "Attendance cannot be recorded for a cancelled registration.",
      );
    }
    if (registration.status === data.status) {
      throw new DomainError(
        "CONFLICT",
        `Attendance is already recorded as ${data.status.toLowerCase().replaceAll("_", " ")}.`,
        409,
      );
    }

    const result = await tx.eventRegistration.updateMany({
      where: {
        id: registration.id,
        collegeId: registration.collegeId,
        status: registration.status,
      },
      data: {
        status: data.status,
        checkedInAt: data.status === "ATTENDED" ? new Date() : null,
      },
    });

    if (result.count !== 1) {
      throw new DomainError(
        "CONFLICT",
        "The registration changed while attendance was corrected.",
        409,
      );
    }

    await revokeAttendanceCredentialsForRegistration(tx, registration.id, registration.collegeId);

    await createNotifications(tx, [
      {
        collegeId: registration.collegeId,
        userId: registration.studentProfile.user.id,
        type: "ATTENDANCE_UPDATE",
        title: "Attendance updated",
        body: `Your attendance for "${registration.event.title}" is now ${data.status === "ATTENDED" ? "recorded as attended" : "recorded as a no-show"}.`,
        actionUrl: "/student/registrations",
      },
    ]);

    await writeAuditLog(tx, {
      collegeId: registration.collegeId,
      actorUserId: actor.id,
      action: registration.status === "CONFIRMED" ? "ATTENDANCE_RECORDED" : "ATTENDANCE_CORRECTED",
      entityType: "EventRegistration",
      entityId: registration.id,
      metadata: {
        eventId: registration.eventId,
        studentName: registration.studentProfile.user.name,
        from: registration.status,
        to: data.status,
        reason: data.reason,
        method: "MANUAL",
      },
    });

    return tx.eventRegistration.findUniqueOrThrow({ where: { id: registration.id } });
  });
}

/**
 * Legacy manual attendance helper kept for existing workflows and tests. New
 * organizer surfaces use correctAttendance so a reason is always recorded.
 */
export async function markAttendance(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(attendanceSchema, input);

  return runInTransaction(prisma, async (tx) => {
    const registration = await tx.eventRegistration.findUnique({
      where: { id: data.registrationId },
      include: {
        event: {
          select: {
            id: true,
            collegeId: true,
            status: true,
            startsAt: true,
            clubId: true,
            club: { select: { status: true, deletedAt: true } },
          },
        },
        studentProfile: {
          select: {
            id: true,
            rollNumber: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!registration || registration.collegeId !== registration.event.collegeId) {
      throw new TenantIsolationError();
    }

    assertCanManageEventAttendance(actor, registration.event);

    if (!["PUBLISHED", "COMPLETED"].includes(registration.event.status)) {
      throw new InvalidTransitionError("Attendance is only available for published events.");
    }

    if (!hasEventStarted(registration.event.startsAt)) {
      throw new InvalidTransitionError("Attendance cannot be recorded before the event starts.");
    }

    if (!REGISTRATION_TRANSITIONS[registration.status].includes(data.status)) {
      throw new InvalidTransitionError(
        `Attendance cannot change from ${registration.status} to ${data.status}.`,
      );
    }

    const result = await tx.eventRegistration.updateMany({
      where: {
        id: registration.id,
        collegeId: registration.collegeId,
        status: registration.status,
      },
      data: {
        status: data.status,
        checkedInAt: data.status === "ATTENDED" ? new Date() : null,
      },
    });

    if (result.count !== 1) {
      throw new DomainError(
        "CONFLICT",
        "The registration changed while attendance was recorded.",
        409,
      );
    }

    await revokeAttendanceCredentialsForRegistration(tx, registration.id, registration.collegeId);

    await writeAuditLog(tx, {
      collegeId: registration.collegeId,
      actorUserId: actor.id,
      action: "REGISTRATION_STATUS_CHANGED",
      entityType: "EventRegistration",
      entityId: registration.id,
      metadata: {
        eventId: registration.eventId,
        studentName: registration.studentProfile.user.name,
        from: registration.status,
        to: data.status,
      },
    });

    return tx.eventRegistration.findUniqueOrThrow({ where: { id: registration.id } });
  });
}

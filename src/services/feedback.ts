import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { isPrismaUniqueConstraintError, runInTransaction } from "@/server/db/transactions";
import {
  ActorNotAuthorizedError,
  DomainError,
  InvalidTransitionError,
  TenantIsolationError,
} from "@/server/errors";
import {
  assertActorActive,
  assertStudent,
  isSuperAdmin,
  type AuthenticatedActor,
} from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";

export const FEEDBACK_WINDOW_DAYS = 30;
export const FEEDBACK_COMMENT_MAX_LENGTH = 2000;

const feedbackInputSchema = z.object({
  eventId: uuidSchema,
  rating: z.coerce
    .number()
    .int("Choose a whole-number rating.")
    .min(1, "Choose a rating from 1 to 5.")
    .max(5, "Choose a rating from 1 to 5."),
  comment: z
    .string()
    .trim()
    .max(
      FEEDBACK_COMMENT_MAX_LENGTH,
      `Feedback must be ${FEEDBACK_COMMENT_MAX_LENGTH} characters or fewer.`,
    )
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
});

const moderationSchema = z.object({
  feedbackId: uuidSchema,
  decision: z.enum(["VISIBLE", "HIDDEN"]),
  reason: z
    .string()
    .trim()
    .min(3, "Provide a short moderation reason.")
    .max(500, "The moderation reason must be 500 characters or fewer."),
});

export function feedbackWindowClosesAt(event: { completedAt: Date | null; endsAt: Date }): Date {
  const completedAt = event.completedAt ?? event.endsAt;
  return new Date(completedAt.getTime() + FEEDBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

type FeedbackContext = {
  profileId: string;
  collegeId: string;
  registrationStatus: string;
  event: {
    id: string;
    collegeId: string;
    status: string;
    completedAt: Date | null;
    endsAt: Date;
    title: string;
  };
  feedback: { id: string } | null;
};

async function loadFeedbackContext(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  eventId: string,
): Promise<FeedbackContext> {
  if (!actor.collegeId) {
    throw new ActorNotAuthorizedError("A student college context is required.");
  }

  const profile = await tx.studentProfile.findUnique({
    where: { userId_collegeId: { userId: actor.id, collegeId: actor.collegeId } },
    select: { id: true, collegeId: true },
  });

  if (!profile) {
    throw new ActorNotAuthorizedError("Only students with a profile can submit feedback.");
  }

  const registration = await tx.eventRegistration.findUnique({
    where: {
      eventId_studentProfileId: {
        eventId,
        studentProfileId: profile.id,
      },
    },
    select: {
      status: true,
      collegeId: true,
      event: {
        select: {
          id: true,
          collegeId: true,
          status: true,
          completedAt: true,
          endsAt: true,
          title: true,
        },
      },
    },
  });

  if (!registration) {
    throw new DomainError("NOT_REGISTERED", "No registration exists for this event.", 404);
  }

  if (
    registration.collegeId !== profile.collegeId ||
    registration.event.collegeId !== profile.collegeId
  ) {
    throw new TenantIsolationError();
  }

  const feedback = await tx.eventFeedback.findUnique({
    where: {
      eventId_studentProfileId: {
        eventId,
        studentProfileId: profile.id,
      },
    },
    select: { id: true },
  });

  return {
    profileId: profile.id,
    collegeId: profile.collegeId,
    registrationStatus: registration.status,
    event: registration.event,
    feedback,
  };
}

function assertFeedbackWindow(context: FeedbackContext, now = new Date()): void {
  if (context.registrationStatus !== "ATTENDED") {
    throw new InvalidTransitionError(
      "Feedback is available only after your attendance has been verified.",
    );
  }

  if (context.event.status !== "COMPLETED") {
    throw new InvalidTransitionError("Feedback is available only after the event is completed.");
  }

  const closesAt = feedbackWindowClosesAt(context.event);
  if (now > closesAt) {
    throw new InvalidTransitionError(
      `The feedback window closed on ${closesAt.toISOString().slice(0, 10)}.`,
    );
  }
}

export async function submitFeedback(actor: AuthenticatedActor, input: unknown) {
  assertStudent(actor);
  const data = parseServiceInput(feedbackInputSchema, input);

  try {
    return await runInTransaction(prisma, async (tx) => {
      const context = await loadFeedbackContext(tx, actor, data.eventId);
      assertFeedbackWindow(context);

      if (context.feedback) {
        throw new DomainError(
          "CONFLICT",
          "You have already submitted feedback for this event.",
          409,
        );
      }

      const feedback = await tx.eventFeedback.create({
        data: {
          collegeId: context.collegeId,
          eventId: context.event.id,
          studentProfileId: context.profileId,
          rating: data.rating,
          comment: data.comment,
        },
      });

      await writeAuditLog(tx, {
        collegeId: context.collegeId,
        actorUserId: actor.id,
        action: "FEEDBACK_SUBMITTED",
        entityType: "EventFeedback",
        entityId: feedback.id,
        metadata: {
          eventId: context.event.id,
          rating: data.rating,
          commentLength: data.comment?.length ?? 0,
        },
      });

      return feedback;
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new DomainError("CONFLICT", "You have already submitted feedback for this event.", 409);
    }

    throw error;
  }
}

export async function updateFeedback(actor: AuthenticatedActor, input: unknown) {
  assertStudent(actor);
  const data = parseServiceInput(feedbackInputSchema, input);

  return runInTransaction(prisma, async (tx) => {
    const context = await loadFeedbackContext(tx, actor, data.eventId);
    assertFeedbackWindow(context);

    if (!context.feedback) {
      throw new DomainError("NOT_FOUND", "No feedback exists for this event yet.", 404);
    }

    const existing = await tx.eventFeedback.findUniqueOrThrow({
      where: { id: context.feedback.id },
      select: { rating: true, comment: true, moderationStatus: true },
    });

    // Edits preserve the existing moderation decision. An author cannot clear a
    // moderator's hidden status by editing their submission.
    const feedback = await tx.eventFeedback.update({
      where: { id: context.feedback.id },
      data: {
        rating: data.rating,
        comment: data.comment,
      },
    });

    await writeAuditLog(tx, {
      collegeId: context.collegeId,
      actorUserId: actor.id,
      action: "FEEDBACK_UPDATED",
      entityType: "EventFeedback",
      entityId: feedback.id,
      metadata: {
        eventId: context.event.id,
        fromRating: existing.rating,
        toRating: data.rating,
        fromCommentLength: existing.comment?.length ?? 0,
        toCommentLength: data.comment?.length ?? 0,
        moderationStatus: existing.moderationStatus,
      },
    });

    return feedback;
  });
}

export async function moderateFeedback(actor: AuthenticatedActor, input: unknown) {
  assertActorActive(actor);
  const data = parseServiceInput(moderationSchema, input);

  return runInTransaction(prisma, async (tx) => {
    const feedback = await tx.eventFeedback.findUnique({
      where: { id: data.feedbackId },
      include: {
        event: { select: { id: true, title: true, collegeId: true } },
      },
    });

    if (!feedback || feedback.collegeId !== feedback.event.collegeId) {
      throw new TenantIsolationError();
    }

    const authorized =
      isSuperAdmin(actor) ||
      (actor.role === "COLLEGE_ADMIN" && actor.collegeId === feedback.collegeId);

    if (!authorized) {
      throw new ActorNotAuthorizedError(
        "Only a college administrator for this college may moderate feedback.",
      );
    }

    if (feedback.moderationStatus === data.decision) {
      throw new DomainError(
        "CONFLICT",
        `Feedback is already ${data.decision === "VISIBLE" ? "visible" : "hidden"}.`,
        409,
      );
    }

    const updated = await tx.eventFeedback.update({
      where: { id: feedback.id },
      data: {
        moderationStatus: data.decision,
        moderatedById: actor.id,
        moderatedAt: new Date(),
        moderationReason: data.reason,
      },
    });

    await writeAuditLog(tx, {
      collegeId: feedback.collegeId,
      actorUserId: actor.id,
      action: "FEEDBACK_MODERATED",
      entityType: "EventFeedback",
      entityId: feedback.id,
      metadata: {
        eventId: feedback.eventId,
        eventTitle: feedback.event.title,
        from: feedback.moderationStatus,
        to: data.decision,
        reason: data.reason,
      },
    });

    return updated;
  });
}

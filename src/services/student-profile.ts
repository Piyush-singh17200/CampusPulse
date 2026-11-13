import "server-only";

import { z } from "zod";

import { prisma } from "@/server/db/client";
import { writeAuditLog } from "@/server/db/audit";
import { runInTransaction } from "@/server/db/transactions";
import { ActorNotAuthorizedError, InvalidInputError } from "@/server/errors";
import { assertStudent, type AuthenticatedActor } from "@/services/authorization";
import { parseServiceInput, uuidSchema } from "@/services/validation";

const updateStudentProfileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  rollNumber: z.string().trim().max(64).nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  graduationYear: z.number().int().min(1900).max(2200).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  interestIds: z.array(uuidSchema).max(20).default([]),
});

function nullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value?.trim() ? value.trim() : null;
}

export async function updateStudentProfile(actor: AuthenticatedActor, input: unknown) {
  assertStudent(actor);

  if (!actor.collegeId) {
    throw new ActorNotAuthorizedError("A student profile and college are required.");
  }

  const data = parseServiceInput(updateStudentProfileSchema, input);

  return runInTransaction(prisma, async (tx) => {
    const profile = await tx.studentProfile.findUnique({
      where: { userId_collegeId: { userId: actor.id, collegeId: actor.collegeId! } },
      select: {
        id: true,
        collegeId: true,
        rollNumber: true,
        department: true,
        graduationYear: true,
        bio: true,
      },
    });

    if (!profile) {
      throw new ActorNotAuthorizedError("Only students with a profile can edit their profile.");
    }

    const interests = data.interestIds.length
      ? await tx.interest.findMany({
          where: { id: { in: data.interestIds }, isActive: true },
          select: { id: true },
        })
      : [];

    if (interests.length !== new Set(data.interestIds).size) {
      throw new InvalidInputError("One or more selected interests are unavailable.");
    }

    const rollNumber = nullableText(data.rollNumber);
    const department = nullableText(data.department);
    const bio = nullableText(data.bio);

    await tx.user.update({
      where: { id: actor.id },
      data: { name: data.name },
    });

    await tx.studentProfile.update({
      where: { id: profile.id },
      data: {
        rollNumber,
        department,
        graduationYear: data.graduationYear,
        bio,
      },
    });

    await tx.studentInterest.deleteMany({
      where: {
        studentProfileId: profile.id,
        ...(data.interestIds.length ? { interestId: { notIn: data.interestIds } } : {}),
      },
    });

    if (data.interestIds.length) {
      await tx.studentInterest.createMany({
        data: data.interestIds.map((interestId) => ({
          collegeId: profile.collegeId,
          studentProfileId: profile.id,
          interestId,
        })),
        skipDuplicates: true,
      });
    }

    const changedFields = [
      "name",
      ...(rollNumber !== undefined ? ["rollNumber"] : []),
      ...(department !== undefined ? ["department"] : []),
      ...(data.graduationYear !== undefined ? ["graduationYear"] : []),
      ...(bio !== undefined ? ["bio"] : []),
      ...(data.interestIds.length ? ["interests"] : []),
    ];

    await writeAuditLog(tx, {
      collegeId: profile.collegeId,
      actorUserId: actor.id,
      action: "USER_PROFILE_UPDATED",
      entityType: "StudentProfile",
      entityId: profile.id,
      metadata: { changedFields },
    });

    return tx.studentProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: { interests: { include: { interest: true } } },
    });
  });
}

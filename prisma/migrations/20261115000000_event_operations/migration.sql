-- CreateEnum
CREATE TYPE "FeedbackModerationStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_CORRECTED';
ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_CREDENTIAL_ISSUED';
ALTER TYPE "AuditAction" ADD VALUE 'FEEDBACK_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'FEEDBACK_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'FEEDBACK_MODERATED';
ALTER TYPE "AuditAction" ADD VALUE 'NOTIFICATION_PREFERENCES_UPDATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'FEEDBACK_UPDATE';

-- AlterTable
ALTER TABLE "event_feedback" ADD COLUMN     "moderatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "moderatedById" UUID,
ADD COLUMN     "moderationReason" VARCHAR(500),
ADD COLUMN     "moderationStatus" "FeedbackModerationStatus" NOT NULL DEFAULT 'VISIBLE';

-- CreateTable
CREATE TABLE "attendance_credentials" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "registrationUpdates" BOOLEAN NOT NULL DEFAULT true,
    "attendanceUpdates" BOOLEAN NOT NULL DEFAULT true,
    "feedbackUpdates" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_credentials_tokenHash_key" ON "attendance_credentials"("tokenHash");

-- CreateIndex
CREATE INDEX "attendance_credentials_collegeId_eventId_idx" ON "attendance_credentials"("collegeId", "eventId");

-- CreateIndex
CREATE INDEX "attendance_credentials_expiresAt_idx" ON "attendance_credentials"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_credentials_registrationId_key" ON "attendance_credentials"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_credentials_registrationId_collegeId_key" ON "attendance_credentials"("registrationId", "collegeId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notification_preferences_collegeId_userId_idx" ON "notification_preferences"("collegeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_collegeId_key" ON "notification_preferences"("userId", "collegeId");

-- CreateIndex
CREATE INDEX "event_feedback_collegeId_moderationStatus_idx" ON "event_feedback"("collegeId", "moderationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_id_collegeId_key" ON "event_registrations"("id", "collegeId");

-- CreateIndex
CREATE INDEX "notifications_collegeId_userId_type_createdAt_idx" ON "notifications"("collegeId", "userId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "attendance_credentials" ADD CONSTRAINT "attendance_credentials_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_credentials" ADD CONSTRAINT "attendance_credentials_eventId_collegeId_fkey" FOREIGN KEY ("eventId", "collegeId") REFERENCES "events"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_credentials" ADD CONSTRAINT "attendance_credentials_registrationId_collegeId_fkey" FOREIGN KEY ("registrationId", "collegeId") REFERENCES "event_registrations"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_collegeId_fkey" FOREIGN KEY ("userId", "collegeId") REFERENCES "users"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

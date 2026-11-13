-- Prompt 5: persistent student saved events and dashboard audit actions.
-- Additive only: existing tables, columns, and constraints are unchanged.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_PROFILE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLUB_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SAVED_EVENT_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'NOTIFICATION_READ';

CREATE TABLE "saved_events" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_events_studentProfileId_eventId_key"
    ON "saved_events"("studentProfileId", "eventId");

CREATE INDEX "saved_events_collegeId_studentProfileId_createdAt_idx"
    ON "saved_events"("collegeId", "studentProfileId", "createdAt");

CREATE INDEX "saved_events_eventId_idx" ON "saved_events"("eventId");

ALTER TABLE "saved_events"
    ADD CONSTRAINT "saved_events_collegeId_fkey"
    FOREIGN KEY ("collegeId") REFERENCES "colleges"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "saved_events"
    ADD CONSTRAINT "saved_events_studentProfileId_collegeId_fkey"
    FOREIGN KEY ("studentProfileId", "collegeId") REFERENCES "student_profiles"("id", "collegeId")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_events"
    ADD CONSTRAINT "saved_events_eventId_collegeId_fkey"
    FOREIGN KEY ("eventId", "collegeId") REFERENCES "events"("id", "collegeId")
    ON DELETE CASCADE ON UPDATE CASCADE;

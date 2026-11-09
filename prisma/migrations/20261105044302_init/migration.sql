-- CreateEnum
CREATE TYPE "CollegeStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'CLUB_ADMIN', 'COLLEGE_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ClubStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClubMembershipRole" AS ENUM ('PRESIDENT', 'OFFICER', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PosterOcrStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'EVENT_REMINDER', 'REGISTRATION_UPDATE', 'MODERATION_UPDATE', 'CLUB_UPDATE');

-- CreateEnum
CREATE TYPE "DuplicateStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_ROLE_CHANGED', 'COLLEGE_CREATED', 'COLLEGE_UPDATED', 'CLUB_APPROVED', 'CLUB_REJECTED', 'EVENT_APPROVED', 'EVENT_REJECTED', 'EVENT_CANCELLED', 'EVENT_STATUS_CHANGED', 'DUPLICATE_CONFIRMED', 'DUPLICATE_DISMISSED', 'REGISTRATION_STATUS_CHANGED');

-- CreateTable
CREATE TABLE "colleges" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "shortName" VARCHAR(48),
    "primaryDomain" VARCHAR(255),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    "status" "CollegeStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "colleges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "collegeId" UUID,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "rollNumber" VARCHAR(64),
    "department" VARCHAR(120),
    "graduationYear" INTEGER,
    "bio" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "status" "ClubStatus" NOT NULL DEFAULT 'PENDING',
    "statusReason" VARCHAR(500),
    "createdById" UUID NOT NULL,
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_memberships" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ClubMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "club_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interests" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_interests" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "interestId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "summary" VARCHAR(500),
    "description" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "registrationOpensAt" TIMESTAMPTZ(3),
    "registrationDeadline" TIMESTAMPTZ(3),
    "venueName" VARCHAR(180) NOT NULL,
    "venueAddress" VARCHAR(300),
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "onlineUrl" VARCHAR(500),
    "capacity" INTEGER,
    "publishedAt" TIMESTAMPTZ(3),
    "rejectedAt" TIMESTAMPTZ(3),
    "rejectionReason" VARCHAR(500),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" VARCHAR(500),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_categories" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "registeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMPTZ(3),
    "checkedInAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_posters" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" VARCHAR(300),
    "ocrText" TEXT,
    "ocrStatus" "PosterOcrStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "ocrReviewedAt" TIMESTAMPTZ(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_posters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_feedback" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "actionUrl" VARCHAR(500),
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_duplicates" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "primaryEventId" UUID NOT NULL,
    "candidateEventId" UUID NOT NULL,
    "status" "DuplicateStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DECIMAL(5,4) NOT NULL,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_duplicates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "collegeId" UUID,
    "actorUserId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(120) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colleges_slug_key" ON "colleges"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "colleges_primaryDomain_key" ON "colleges"("primaryDomain");

-- CreateIndex
CREATE INDEX "colleges_status_idx" ON "colleges"("status");

-- CreateIndex
CREATE INDEX "colleges_createdAt_idx" ON "colleges"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_collegeId_role_status_idx" ON "users"("collegeId", "role", "status");

-- CreateIndex
CREATE INDEX "users_collegeId_createdAt_idx" ON "users"("collegeId", "createdAt");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_id_collegeId_key" ON "users"("id", "collegeId");

-- CreateIndex
CREATE INDEX "student_profiles_collegeId_graduationYear_idx" ON "student_profiles"("collegeId", "graduationYear");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_userId_collegeId_key" ON "student_profiles"("userId", "collegeId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_id_collegeId_key" ON "student_profiles"("id", "collegeId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_collegeId_rollNumber_key" ON "student_profiles"("collegeId", "rollNumber");

-- CreateIndex
CREATE INDEX "clubs_collegeId_status_idx" ON "clubs"("collegeId", "status");

-- CreateIndex
CREATE INDEX "clubs_collegeId_name_idx" ON "clubs"("collegeId", "name");

-- CreateIndex
CREATE INDEX "clubs_createdById_idx" ON "clubs"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_collegeId_slug_key" ON "clubs"("collegeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_id_collegeId_key" ON "clubs"("id", "collegeId");

-- CreateIndex
CREATE INDEX "club_memberships_collegeId_userId_status_idx" ON "club_memberships"("collegeId", "userId", "status");

-- CreateIndex
CREATE INDEX "club_memberships_clubId_status_idx" ON "club_memberships"("clubId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "club_memberships_clubId_userId_key" ON "club_memberships"("clubId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "interests_name_key" ON "interests"("name");

-- CreateIndex
CREATE UNIQUE INDEX "interests_slug_key" ON "interests"("slug");

-- CreateIndex
CREATE INDEX "interests_isActive_sortOrder_idx" ON "interests"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "student_interests_collegeId_interestId_idx" ON "student_interests"("collegeId", "interestId");

-- CreateIndex
CREATE UNIQUE INDEX "student_interests_studentProfileId_interestId_key" ON "student_interests"("studentProfileId", "interestId");

-- CreateIndex
CREATE INDEX "categories_collegeId_isActive_sortOrder_idx" ON "categories"("collegeId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "categories_collegeId_slug_key" ON "categories"("collegeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_id_collegeId_key" ON "categories"("id", "collegeId");

-- CreateIndex
CREATE INDEX "events_collegeId_status_startsAt_idx" ON "events"("collegeId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "events_collegeId_clubId_startsAt_idx" ON "events"("collegeId", "clubId", "startsAt");

-- CreateIndex
CREATE INDEX "events_collegeId_createdAt_idx" ON "events"("collegeId", "createdAt");

-- CreateIndex
CREATE INDEX "events_createdById_idx" ON "events"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "events_collegeId_slug_key" ON "events"("collegeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "events_id_collegeId_key" ON "events"("id", "collegeId");

-- CreateIndex
CREATE INDEX "event_categories_collegeId_categoryId_idx" ON "event_categories"("collegeId", "categoryId");

-- CreateIndex
CREATE INDEX "event_categories_eventId_idx" ON "event_categories"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_categories_eventId_categoryId_key" ON "event_categories"("eventId", "categoryId");

-- CreateIndex
CREATE INDEX "event_registrations_collegeId_eventId_status_idx" ON "event_registrations"("collegeId", "eventId", "status");

-- CreateIndex
CREATE INDEX "event_registrations_collegeId_studentProfileId_registeredAt_idx" ON "event_registrations"("collegeId", "studentProfileId", "registeredAt");

-- CreateIndex
CREATE INDEX "event_registrations_eventId_status_idx" ON "event_registrations"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_eventId_studentProfileId_key" ON "event_registrations"("eventId", "studentProfileId");

-- CreateIndex
CREATE INDEX "event_posters_eventId_isPrimary_idx" ON "event_posters"("eventId", "isPrimary");

-- CreateIndex
CREATE INDEX "event_posters_collegeId_ocrStatus_idx" ON "event_posters"("collegeId", "ocrStatus");

-- CreateIndex
CREATE INDEX "event_feedback_collegeId_eventId_rating_idx" ON "event_feedback"("collegeId", "eventId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "event_feedback_eventId_studentProfileId_key" ON "event_feedback"("eventId", "studentProfileId");

-- CreateIndex
CREATE INDEX "notifications_collegeId_userId_readAt_idx" ON "notifications"("collegeId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "event_duplicates_collegeId_status_idx" ON "event_duplicates"("collegeId", "status");

-- CreateIndex
CREATE INDEX "event_duplicates_candidateEventId_idx" ON "event_duplicates"("candidateEventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_duplicates_primaryEventId_candidateEventId_key" ON "event_duplicates"("primaryEventId", "candidateEventId");

-- CreateIndex
CREATE INDEX "audit_logs_collegeId_createdAt_idx" ON "audit_logs"("collegeId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_collegeId_fkey" FOREIGN KEY ("userId", "collegeId") REFERENCES "users"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_createdById_collegeId_fkey" FOREIGN KEY ("createdById", "collegeId") REFERENCES "users"("id", "collegeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_clubId_collegeId_fkey" FOREIGN KEY ("clubId", "collegeId") REFERENCES "clubs"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_userId_collegeId_fkey" FOREIGN KEY ("userId", "collegeId") REFERENCES "users"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_interests" ADD CONSTRAINT "student_interests_studentProfileId_collegeId_fkey" FOREIGN KEY ("studentProfileId", "collegeId") REFERENCES "student_profiles"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_interests" ADD CONSTRAINT "student_interests_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_clubId_collegeId_fkey" FOREIGN KEY ("clubId", "collegeId") REFERENCES "clubs"("id", "collegeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_collegeId_fkey" FOREIGN KEY ("createdById", "collegeId") REFERENCES "users"("id", "collegeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_eventId_collegeId_fkey" FOREIGN KEY ("eventId", "collegeId") REFERENCES "events"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_categoryId_collegeId_fkey" FOREIGN KEY ("categoryId", "collegeId") REFERENCES "categories"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_eventId_collegeId_fkey" FOREIGN KEY ("eventId", "collegeId") REFERENCES "events"("id", "collegeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_studentProfileId_collegeId_fkey" FOREIGN KEY ("studentProfileId", "collegeId") REFERENCES "student_profiles"("id", "collegeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_posters" ADD CONSTRAINT "event_posters_eventId_collegeId_fkey" FOREIGN KEY ("eventId", "collegeId") REFERENCES "events"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_eventId_collegeId_fkey" FOREIGN KEY ("eventId", "collegeId") REFERENCES "events"("id", "collegeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_studentProfileId_collegeId_fkey" FOREIGN KEY ("studentProfileId", "collegeId") REFERENCES "student_profiles"("id", "collegeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_collegeId_fkey" FOREIGN KEY ("userId", "collegeId") REFERENCES "users"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_duplicates" ADD CONSTRAINT "event_duplicates_primaryEventId_collegeId_fkey" FOREIGN KEY ("primaryEventId", "collegeId") REFERENCES "events"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_duplicates" ADD CONSTRAINT "event_duplicates_candidateEventId_collegeId_fkey" FOREIGN KEY ("candidateEventId", "collegeId") REFERENCES "events"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_duplicates" ADD CONSTRAINT "event_duplicates_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- PostgreSQL integrity constraints
-- Prisma does not model CHECK constraints or partial unique indexes directly.
-- These rules back up the service-layer lifecycle and registration invariants.
-- ---------------------------------------------------------------------------

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_requires_college"
  CHECK ("role" = 'SUPER_ADMIN' OR "collegeId" IS NOT NULL);

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_not_blank"
  CHECK (length(btrim("email")) > 0);

ALTER TABLE "student_profiles"
  ADD CONSTRAINT "student_profiles_graduation_year_range"
  CHECK ("graduationYear" IS NULL OR "graduationYear" BETWEEN 1900 AND 2200);

ALTER TABLE "events"
  ADD CONSTRAINT "events_end_after_start"
  CHECK ("endsAt" > "startsAt");

ALTER TABLE "events"
  ADD CONSTRAINT "events_capacity_positive"
  CHECK ("capacity" IS NULL OR "capacity" > 0);

ALTER TABLE "events"
  ADD CONSTRAINT "events_registration_window_order"
  CHECK (
    "registrationOpensAt" IS NULL
    OR "registrationDeadline" IS NULL
    OR "registrationOpensAt" < "registrationDeadline"
  );

ALTER TABLE "events"
  ADD CONSTRAINT "events_registration_deadline_before_start"
  CHECK ("registrationDeadline" IS NULL OR "registrationDeadline" <= "startsAt");

ALTER TABLE "events"
  ADD CONSTRAINT "events_online_requires_url"
  CHECK ("isOnline" = false OR "onlineUrl" IS NOT NULL);

ALTER TABLE "events"
  ADD CONSTRAINT "events_published_requires_timestamp"
  CHECK ("status" NOT IN ('PUBLISHED', 'COMPLETED') OR "publishedAt" IS NOT NULL);

ALTER TABLE "events"
  ADD CONSTRAINT "events_rejected_requires_timestamp"
  CHECK ("status" <> 'REJECTED' OR "rejectedAt" IS NOT NULL);

ALTER TABLE "events"
  ADD CONSTRAINT "events_cancelled_requires_timestamp"
  CHECK ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL);

ALTER TABLE "events"
  ADD CONSTRAINT "events_completed_requires_timestamp"
  CHECK ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL);

ALTER TABLE "event_registrations"
  ADD CONSTRAINT "event_registrations_cancelled_requires_timestamp"
  CHECK ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL);

ALTER TABLE "event_registrations"
  ADD CONSTRAINT "event_registrations_attended_requires_checkin"
  CHECK ("status" <> 'ATTENDED' OR "checkedInAt" IS NOT NULL);

ALTER TABLE "event_feedback"
  ADD CONSTRAINT "event_feedback_rating_range"
  CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "event_posters"
  ADD CONSTRAINT "event_posters_byte_size_positive"
  CHECK ("byteSize" > 0);

ALTER TABLE "event_posters"
  ADD CONSTRAINT "event_posters_image_mime_type"
  CHECK ("mimeType" LIKE 'image/%');

ALTER TABLE "event_duplicates"
  ADD CONSTRAINT "event_duplicates_not_self"
  CHECK ("primaryEventId" <> "candidateEventId");

ALTER TABLE "event_duplicates"
  ADD CONSTRAINT "event_duplicates_confidence_range"
  CHECK ("confidence" >= 0 AND "confidence" <= 1);

CREATE UNIQUE INDEX "event_posters_one_primary_per_event"
  ON "event_posters" ("eventId")
  WHERE "isPrimary" = true;

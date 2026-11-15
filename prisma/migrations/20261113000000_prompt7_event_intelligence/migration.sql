-- CreateEnum
CREATE TYPE "PosterOcrFieldName" AS ENUM ('TITLE', 'SUMMARY', 'DESCRIPTION', 'START_DATE', 'START_TIME', 'END_DATE', 'END_TIME', 'REGISTRATION_DEADLINE_DATE', 'REGISTRATION_DEADLINE_TIME', 'VENUE', 'VENUE_ADDRESS', 'ORGANIZER', 'CONTACT', 'CATEGORY');

-- CreateEnum
CREATE TYPE "PosterOcrExtractionStatus" AS ENUM ('EXTRACTED', 'AMBIGUOUS', 'MISSING', 'INVALID');

-- CreateEnum
CREATE TYPE "PosterOcrReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "event_duplicates" ADD COLUMN     "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "event_posters" ADD COLUMN     "ocrCompletedAt" TIMESTAMPTZ(3),
ADD COLUMN     "ocrError" VARCHAR(500),
ADD COLUMN     "ocrStartedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "event_interests" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "interestId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poster_ocr_fields" (
    "id" UUID NOT NULL,
    "collegeId" UUID NOT NULL,
    "posterId" UUID NOT NULL,
    "field" "PosterOcrFieldName" NOT NULL,
    "value" TEXT,
    "confidence" DOUBLE PRECISION,
    "evidence" TEXT,
    "extractionStatus" "PosterOcrExtractionStatus" NOT NULL,
    "reviewStatus" "PosterOcrReviewStatus" NOT NULL DEFAULT 'PENDING',
    "requiresReview" BOOLEAN NOT NULL DEFAULT true,
    "reviewedValue" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "poster_ocr_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_interests_collegeId_interestId_idx" ON "event_interests"("collegeId", "interestId");

-- CreateIndex
CREATE INDEX "event_interests_eventId_idx" ON "event_interests"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_interests_eventId_interestId_key" ON "event_interests"("eventId", "interestId");

-- CreateIndex
CREATE INDEX "poster_ocr_fields_collegeId_posterId_idx" ON "poster_ocr_fields"("collegeId", "posterId");

-- CreateIndex
CREATE UNIQUE INDEX "poster_ocr_fields_posterId_field_key" ON "poster_ocr_fields"("posterId", "field");

-- CreateIndex
CREATE INDEX "event_duplicates_primaryEventId_status_idx" ON "event_duplicates"("primaryEventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_posters_id_collegeId_key" ON "event_posters"("id", "collegeId");

-- AddForeignKey
ALTER TABLE "event_interests" ADD CONSTRAINT "event_interests_eventId_collegeId_fkey" FOREIGN KEY ("eventId", "collegeId") REFERENCES "events"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_interests" ADD CONSTRAINT "event_interests_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poster_ocr_fields" ADD CONSTRAINT "poster_ocr_fields_posterId_collegeId_fkey" FOREIGN KEY ("posterId", "collegeId") REFERENCES "event_posters"("id", "collegeId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Run this in your Supabase SQL editor (Database → SQL Editor → New Query)
-- Adds the FeatureRequest and FeatureRequestVote tables

-- Enum
CREATE TYPE "FeatureRequestStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'IN_BETA', 'COMPLETED');

-- Feature requests table
CREATE TABLE "FeatureRequest" (
    "id"          TEXT          NOT NULL,
    "title"       TEXT          NOT NULL,
    "description" TEXT,
    "status"      "FeatureRequestStatus" NOT NULL DEFAULT 'PLANNED',
    "authorId"    TEXT,
    "authorName"  TEXT,
    "pinned"      BOOLEAN       NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureRequest_pkey" PRIMARY KEY ("id")
);

-- Votes table (one vote per user per request)
CREATE TABLE "FeatureRequestVote" (
    "id"               TEXT         NOT NULL,
    "featureRequestId" TEXT         NOT NULL,
    "userId"           TEXT         NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureRequestVote_pkey" PRIMARY KEY ("id")
);

-- Unique: one vote per user per request
ALTER TABLE "FeatureRequestVote"
    ADD CONSTRAINT "FeatureRequestVote_featureRequestId_userId_key"
    UNIQUE ("featureRequestId", "userId");

-- Foreign keys
ALTER TABLE "FeatureRequestVote"
    ADD CONSTRAINT "FeatureRequestVote_featureRequestId_fkey"
    FOREIGN KEY ("featureRequestId")
    REFERENCES "FeatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeatureRequestVote"
    ADD CONSTRAINT "FeatureRequestVote_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "FeatureRequest_status_idx"      ON "FeatureRequest"("status");
CREATE INDEX "FeatureRequest_createdAt_idx"   ON "FeatureRequest"("createdAt");
CREATE INDEX "FeatureRequestVote_featureRequestId_idx" ON "FeatureRequestVote"("featureRequestId");
CREATE INDEX "FeatureRequestVote_userId_idx"  ON "FeatureRequestVote"("userId");

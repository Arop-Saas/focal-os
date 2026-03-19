-- Add gcalEventId to JobAssignment table
-- Run this in the Supabase SQL Editor

ALTER TABLE "JobAssignment"
ADD COLUMN IF NOT EXISTS "gcalEventId" TEXT;

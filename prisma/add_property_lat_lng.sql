-- Add latitude/longitude columns to Job table for Mapbox map integration
-- Run: npx prisma db push (or execute this SQL directly against Supabase)

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "propertyLat" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "propertyLng" DOUBLE PRECISION;

-- S4: hashed gallery passwords + delivery SLA timestamp.
ALTER TABLE "Gallery" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
-- Backfill deliveredAt for already-delivered jobs from their status history:
UPDATE "Job" j SET "deliveredAt" = h."createdAt"
FROM (
  SELECT "jobId", MIN("createdAt") AS "createdAt"
  FROM "JobStatusHistory" WHERE status = 'DELIVERED' GROUP BY "jobId"
) h
WHERE j.id = h."jobId" AND j."deliveredAt" IS NULL;

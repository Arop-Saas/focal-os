-- S1: photographer time-off (vacations, personal blocks) — consumed by the
-- scheduling engine to exclude slots.

CREATE TABLE IF NOT EXISTS "StaffTimeOff" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffTimeOff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StaffTimeOff_staffId_startsAt_idx" ON "StaffTimeOff"("staffId", "startsAt");

DO $$ BEGIN
  ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- S6: payroll-grade time + mileage records (Build Brief W3/W7).
CREATE TABLE IF NOT EXISTS "TimeEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "jobId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CLOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TimeEntry_workspaceId_startedAt_idx" ON "TimeEntry"("workspaceId", "startedAt");
CREATE INDEX IF NOT EXISTS "TimeEntry_staffId_startedAt_idx" ON "TimeEntry"("staffId", "startedAt");
CREATE TABLE IF NOT EXISTS "MileageEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "jobId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MileageEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MileageEntry_workspaceId_date_idx" ON "MileageEntry"("workspaceId", "date");
CREATE INDEX IF NOT EXISTS "MileageEntry_staffId_date_idx" ON "MileageEntry"("staffId", "date");
CREATE INDEX IF NOT EXISTS "MileageEntry_jobId_idx" ON "MileageEntry"("jobId");

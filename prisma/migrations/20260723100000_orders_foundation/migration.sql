-- Orders foundation: Property, Appointment, ProductionTask, JobNote
-- + Job.propertyId, JobAssignment.appointmentId. Additive only.
-- Backfills a primary Appointment for every already-scheduled Job.

-- Enums
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'CAPTURED', 'POSTPONED', 'CANCELLED');
CREATE TYPE "ProductionTaskType" AS ENUM ('PHOTO_EDITING', 'VIDEO_EDITING', 'FLOOR_PLAN', 'VIRTUAL_TOUR', 'QA', 'OTHER');
CREATE TYPE "ProductionStatus" AS ENUM ('WAITING_FILES', 'QUEUED', 'IN_PROGRESS', 'QA', 'REVISION', 'READY');
CREATE TYPE "JobNoteKind" AS ENUM ('CUSTOMER_INSTRUCTIONS', 'INTERNAL', 'FIELD', 'EDITOR', 'QA_REVISION');

-- Property
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "unit" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "propertyType" "PropertyType" NOT NULL DEFAULT 'RESIDENTIAL',
    "squareFootage" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "mlsNumber" TEXT,
    "listingUrl" TEXT,
    "accessNotes" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- Appointment
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "title" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "durationMins" INTEGER NOT NULL DEFAULT 90,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- ProductionTask
CREATE TABLE "ProductionTask" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "ProductionTaskType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'WAITING_FILES',
    "assigneeStaffId" TEXT,
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionTask_pkey" PRIMARY KEY ("id")
);

-- JobNote
CREATE TABLE "JobNote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "JobNoteKind" NOT NULL DEFAULT 'INTERNAL',
    "body" TEXT NOT NULL,
    "authorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobNote_pkey" PRIMARY KEY ("id")
);

-- New columns on existing tables
ALTER TABLE "Job" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "JobAssignment" ADD COLUMN "appointmentId" TEXT;

-- Indexes
CREATE UNIQUE INDEX "Property_workspaceId_dedupeKey_key" ON "Property"("workspaceId", "dedupeKey");
CREATE INDEX "Property_workspaceId_idx" ON "Property"("workspaceId");
CREATE INDEX "Appointment_workspaceId_scheduledAt_idx" ON "Appointment"("workspaceId", "scheduledAt");
CREATE INDEX "Appointment_jobId_idx" ON "Appointment"("jobId");
CREATE INDEX "ProductionTask_workspaceId_status_idx" ON "ProductionTask"("workspaceId", "status");
CREATE INDEX "ProductionTask_jobId_idx" ON "ProductionTask"("jobId");
CREATE INDEX "ProductionTask_assigneeStaffId_idx" ON "ProductionTask"("assigneeStaffId");
CREATE INDEX "JobNote_jobId_idx" ON "JobNote"("jobId");
CREATE INDEX "JobNote_workspaceId_idx" ON "JobNote"("workspaceId");
CREATE INDEX "Job_propertyId_idx" ON "Job"("propertyId");
CREATE INDEX "JobAssignment_appointmentId_idx" ON "JobAssignment"("appointmentId");

-- Foreign keys
ALTER TABLE "Property" ADD CONSTRAINT "Property_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_assigneeStaffId_fkey" FOREIGN KEY ("assigneeStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobNote" ADD CONSTRAINT "JobNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobNote" ADD CONSTRAINT "JobNote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobNote" ADD CONSTRAINT "JobNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one primary Appointment per already-scheduled Job.
-- Deterministic ids (md5 of jobId) make this idempotent if ever re-run.
INSERT INTO "Appointment" ("id", "workspaceId", "jobId", "scheduledAt", "durationMins", "status", "isPrimary", "createdAt", "updatedAt")
SELECT
    'apt' || substr(md5(j."id" || ':primary'), 1, 21),
    j."workspaceId",
    j."id",
    j."scheduledAt",
    j."estimatedDurationMins",
    CASE
        WHEN j."status" = 'CANCELLED' THEN 'CANCELLED'::"AppointmentStatus"
        WHEN j."status" IN ('IN_PROGRESS', 'EDITING', 'REVIEW', 'DELIVERED', 'COMPLETED') THEN 'CAPTURED'::"AppointmentStatus"
        ELSE 'SCHEDULED'::"AppointmentStatus"
    END,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Job" j
WHERE j."scheduledAt" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

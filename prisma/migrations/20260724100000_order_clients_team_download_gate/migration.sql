-- Multiple clients per order, team attachment, per-listing download payment gate.
ALTER TABLE "Job" ADD COLUMN "customerTeamId" TEXT;
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerTeamId_fkey" FOREIGN KEY ("customerTeamId") REFERENCES "CustomerTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Gallery" ADD COLUMN "requirePaymentForDownload" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "JobClient" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobClient_jobId_clientId_key" ON "JobClient"("jobId", "clientId");
CREATE INDEX "JobClient_clientId_idx" ON "JobClient"("clientId");

ALTER TABLE "JobClient" ADD CONSTRAINT "JobClient_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobClient" ADD CONSTRAINT "JobClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

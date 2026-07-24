-- Team tasks (Collaboration → Tasks): checkbox to-dos, optionally attached to an order.
CREATE TABLE "TeamTask" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "jobId" TEXT,
    "assignedUserId" TEXT,
    "createdByUserId" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamTask_workspaceId_completedAt_idx" ON "TeamTask"("workspaceId", "completedAt");
CREATE INDEX "TeamTask_jobId_idx" ON "TeamTask"("jobId");

ALTER TABLE "TeamTask" ADD CONSTRAINT "TeamTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamTask" ADD CONSTRAINT "TeamTask_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamTask" ADD CONSTRAINT "TeamTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamTask" ADD CONSTRAINT "TeamTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

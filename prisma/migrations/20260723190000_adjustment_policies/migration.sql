-- Phase 2: order-level adjustments (rush, after-hours, weekend, minimum order)
CREATE TYPE "AdjustmentType" AS ENUM ('RUSH', 'AFTER_HOURS', 'WEEKEND', 'MINIMUM_ORDER');
CREATE TABLE "AdjustmentPolicy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "amountType" TEXT NOT NULL DEFAULT 'FLAT',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "afterHoursStart" INTEGER,
    "afterHoursEnd" INTEGER,
    "minimumOrderAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdjustmentPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdjustmentPolicy_workspaceId_type_key" ON "AdjustmentPolicy"("workspaceId", "type");
ALTER TABLE "AdjustmentPolicy" ADD CONSTRAINT "AdjustmentPolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

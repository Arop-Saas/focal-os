-- Phase 2: pricing plans (brokerage / client / everyone price overrides)
CREATE TABLE "PricingPlan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "brokerageGroupId" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PricingPlan_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PricingPlanEntry" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "overridePrice" DOUBLE PRECISION,
    "percentAdjust" DOUBLE PRECISION,
    CONSTRAINT "PricingPlanEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PricingPlan_workspaceId_active_idx" ON "PricingPlan"("workspaceId", "active");
CREATE UNIQUE INDEX "PricingPlanEntry_planId_catalogItemId_key" ON "PricingPlanEntry"("planId", "catalogItemId");
ALTER TABLE "PricingPlan" ADD CONSTRAINT "PricingPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingPlan" ADD CONSTRAINT "PricingPlan_brokerageGroupId_fkey" FOREIGN KEY ("brokerageGroupId") REFERENCES "BrokerageGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingPlan" ADD CONSTRAINT "PricingPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingPlanEntry" ADD CONSTRAINT "PricingPlanEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PricingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingPlanEntry" ADD CONSTRAINT "PricingPlanEntry_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

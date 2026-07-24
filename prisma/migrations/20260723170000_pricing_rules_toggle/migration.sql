-- Rule-based pricing is opt-in; workspaces already using rules stay enabled
ALTER TABLE "Workspace" ADD COLUMN "pricingRulesEnabled" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Workspace" SET "pricingRulesEnabled" = true
WHERE "id" IN (SELECT DISTINCT "workspaceId" FROM "ProductRule");

-- Services & Pricing catalog foundation (docs/services-products-plan.md, Phase 1).
-- Additive only. Backfills every existing Service/Package as a published
-- catalog item (v1) so the catalog is populated from day one.

-- Enums
CREATE TYPE "CatalogItemRole" AS ENUM ('MAIN', 'ADD_ON', 'PACKAGE');
CREATE TYPE "FulfillmentMode" AS ENUM ('ON_SITE', 'PRODUCTION_ONLY', 'HYBRID');
CREATE TYPE "CatalogPricingMode" AS ENUM ('FIXED', 'STARTING_AT', 'PER_UNIT', 'COMPONENT_SUM');
CREATE TYPE "PublicationState" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "VisitMode" AS ENUM ('NONE', 'SAME_VISIT', 'SEPARATE_VISIT');

-- Tables
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "CatalogItemRole" NOT NULL DEFAULT 'MAIN',
    "state" "PublicationState" NOT NULL DEFAULT 'DRAFT',
    "category" TEXT,
    "legacyServiceId" TEXT,
    "legacyPackageId" TEXT,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogItemVersion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "pricingMode" "CatalogPricingMode" NOT NULL DEFAULT 'FIXED',
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitLabel" TEXT,
    "fulfillmentMode" "FulfillmentMode" NOT NULL DEFAULT 'ON_SITE',
    "visitMode" "VisitMode" NOT NULL DEFAULT 'SAME_VISIT',
    "baseDurationMins" INTEGER NOT NULL DEFAULT 60,
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productionTaskType" "ProductionTaskType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogItemVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "orderFormId" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "labelOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PackageComponent" (
    "id" TEXT NOT NULL,
    "packageItemId" TEXT NOT NULL,
    "childItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "showOnForm" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PackageComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "itemId" TEXT,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "conditionType" TEXT NOT NULL DEFAULT 'SQFT_RANGE',
    "conditionMin" DOUBLE PRECISION,
    "conditionMax" DOUBLE PRECISION,
    "priceAdd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationAddMins" INTEGER NOT NULL DEFAULT 0,
    "quantitySet" INTEGER,
    "hide" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderLineSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "versionId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'CATALOG',
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 0,
    "visitMode" "VisitMode" NOT NULL DEFAULT 'SAME_VISIT',
    "fulfillmentMode" "FulfillmentMode" NOT NULL DEFAULT 'ON_SITE',
    "explanation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderLineSnapshot_pkey" PRIMARY KEY ("id")
);

-- Indexes / uniques
CREATE UNIQUE INDEX "CatalogItem_legacyServiceId_key" ON "CatalogItem"("legacyServiceId");
CREATE UNIQUE INDEX "CatalogItem_legacyPackageId_key" ON "CatalogItem"("legacyPackageId");
CREATE UNIQUE INDEX "CatalogItem_currentVersionId_key" ON "CatalogItem"("currentVersionId");
CREATE INDEX "CatalogItem_workspaceId_state_idx" ON "CatalogItem"("workspaceId", "state");
CREATE UNIQUE INDEX "CatalogItemVersion_itemId_versionNumber_key" ON "CatalogItemVersion"("itemId", "versionNumber");
CREATE UNIQUE INDEX "Offering_itemId_orderFormId_key" ON "Offering"("itemId", "orderFormId");
CREATE INDEX "Offering_orderFormId_idx" ON "Offering"("orderFormId");
CREATE INDEX "Offering_workspaceId_idx" ON "Offering"("workspaceId");
CREATE UNIQUE INDEX "PackageComponent_packageItemId_childItemId_key" ON "PackageComponent"("packageItemId", "childItemId");
CREATE INDEX "ProductRule_workspaceId_itemId_idx" ON "ProductRule"("workspaceId", "itemId");
CREATE INDEX "OrderLineSnapshot_jobId_idx" ON "OrderLineSnapshot"("jobId");
CREATE INDEX "OrderLineSnapshot_workspaceId_idx" ON "OrderLineSnapshot"("workspaceId");

-- Foreign keys
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "CatalogItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CatalogItemVersion" ADD CONSTRAINT "CatalogItemVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_orderFormId_fkey" FOREIGN KEY ("orderFormId") REFERENCES "OrderForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackageComponent" ADD CONSTRAINT "PackageComponent_packageItemId_fkey" FOREIGN KEY ("packageItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackageComponent" ADD CONSTRAINT "PackageComponent_childItemId_fkey" FOREIGN KEY ("childItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductRule" ADD CONSTRAINT "ProductRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductRule" ADD CONSTRAINT "ProductRule_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLineSnapshot" ADD CONSTRAINT "OrderLineSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLineSnapshot" ADD CONSTRAINT "OrderLineSnapshot_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLineSnapshot" ADD CONSTRAINT "OrderLineSnapshot_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Backfill: every Service becomes a published MAIN catalog item ──
INSERT INTO "CatalogItem" ("id", "workspaceId", "role", "state", "category", "legacyServiceId", "createdAt", "updatedAt")
SELECT
    'cat' || substr(md5(s."id" || ':item'), 1, 21),
    s."workspaceId",
    'MAIN'::"CatalogItemRole",
    CASE WHEN s."isActive" THEN 'PUBLISHED' ELSE 'ARCHIVED' END::"PublicationState",
    initcap(replace(s."category"::text, '_', ' ')),
    s."id",
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Service" s
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CatalogItemVersion" ("id", "itemId", "versionNumber", "name", "description", "imageUrl", "pricingMode", "basePrice", "fulfillmentMode", "visitMode", "baseDurationMins", "requiredSkills", "createdAt")
SELECT
    'catv' || substr(md5(s."id" || ':v1'), 1, 20),
    'cat' || substr(md5(s."id" || ':item'), 1, 21),
    1, s."name", s."description", s."coverImage",
    'FIXED'::"CatalogPricingMode", s."basePrice",
    'ON_SITE'::"FulfillmentMode", 'SAME_VISIT'::"VisitMode",
    COALESCE(s."durationMins", 60), ARRAY[]::TEXT[], CURRENT_TIMESTAMP
FROM "Service" s
ON CONFLICT ("id") DO NOTHING;

-- ── Backfill: every Package becomes a published PACKAGE catalog item ──
INSERT INTO "CatalogItem" ("id", "workspaceId", "role", "state", "legacyPackageId", "createdAt", "updatedAt")
SELECT
    'cat' || substr(md5(p."id" || ':item'), 1, 21),
    p."workspaceId",
    'PACKAGE'::"CatalogItemRole",
    CASE WHEN p."isActive" THEN 'PUBLISHED' ELSE 'ARCHIVED' END::"PublicationState",
    p."id",
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Package" p
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CatalogItemVersion" ("id", "itemId", "versionNumber", "name", "description", "imageUrl", "pricingMode", "basePrice", "fulfillmentMode", "visitMode", "baseDurationMins", "requiredSkills", "createdAt")
SELECT
    'catv' || substr(md5(p."id" || ':v1'), 1, 20),
    'cat' || substr(md5(p."id" || ':item'), 1, 21),
    1, p."name", p."description", p."coverImage",
    'FIXED'::"CatalogPricingMode", p."price",
    'HYBRID'::"FulfillmentMode", 'SAME_VISIT'::"VisitMode",
    COALESCE(p."durationMins", 90), ARRAY[]::TEXT[], CURRENT_TIMESTAMP
FROM "Package" p
ON CONFLICT ("id") DO NOTHING;

-- Point items at their v1
UPDATE "CatalogItem" ci
SET "currentVersionId" = 'catv' || substr(md5(ci."legacyServiceId" || ':v1'), 1, 20)
WHERE ci."legacyServiceId" IS NOT NULL AND ci."currentVersionId" IS NULL;

UPDATE "CatalogItem" ci
SET "currentVersionId" = 'catv' || substr(md5(ci."legacyPackageId" || ':v1'), 1, 20)
WHERE ci."legacyPackageId" IS NOT NULL AND ci."currentVersionId" IS NULL;

-- Package components from PackageItem (references, never clones)
INSERT INTO "PackageComponent" ("id", "packageItemId", "childItemId", "quantity", "showOnForm")
SELECT
    'catc' || substr(md5(pi."id" || ':comp'), 1, 20),
    'cat' || substr(md5(pi."packageId" || ':item'), 1, 21),
    'cat' || substr(md5(pi."serviceId" || ':item'), 1, 21),
    COALESCE(pi."quantity", 1),
    true
FROM "PackageItem" pi
ON CONFLICT ("packageItemId", "childItemId") DO NOTHING;

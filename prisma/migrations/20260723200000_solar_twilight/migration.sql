-- Twilight solar scheduling markers
ALTER TABLE "CatalogItemVersion" ADD COLUMN "solarConstraint" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN "timeConstraint" TEXT;

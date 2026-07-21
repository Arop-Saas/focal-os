-- S8: revocable portal sessions (R8) + client credit ledger (B9).
-- Additive only; legacy stateless portal cookies keep verifying until
-- they expire or Client.portalRevokedAt cuts them off.

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "portalRevokedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PortalSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PortalSession_tokenHash_key" ON "PortalSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "PortalSession_clientId_idx" ON "PortalSession"("clientId");
CREATE INDEX IF NOT EXISTS "PortalSession_workspaceId_expiresAt_idx" ON "PortalSession"("workspaceId", "expiresAt");

ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClientCredit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "invoiceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientCredit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientCredit_clientId_createdAt_idx" ON "ClientCredit"("clientId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClientCredit_workspaceId_createdAt_idx" ON "ClientCredit"("workspaceId", "createdAt");

ALTER TABLE "ClientCredit" ADD CONSTRAINT "ClientCredit_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientCredit" ADD CONSTRAINT "ClientCredit_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- S3 money pipeline: Stripe Connect, split job/invoice counters, payment
-- ledger idempotency, tokenized public pay links + data backfills.

ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "jobPrefix" TEXT NOT NULL DEFAULT 'JOB';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "jobNextNumber" INTEGER NOT NULL DEFAULT 1001;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "stripeEventId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_stripeEventId_key" ON "Payment"("stripeEventId");
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "payToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_payToken_key" ON "Invoice"("payToken");

-- Backfills (existing workspaces are Canadian studios; new ones choose):
UPDATE "Workspace" SET "currency" = 'CAD' WHERE "currency" = 'USD';
UPDATE "Workspace" SET "autoCreateInvoice" = true;
ALTER TABLE "Workspace" ALTER COLUMN "autoCreateInvoice" SET DEFAULT true;
-- Seed the job counter from the shared counter so numbers keep ascending:
UPDATE "Workspace" SET "jobNextNumber" = "invoiceNextNumber";
-- Tokens for any existing invoices:
UPDATE "Invoice" SET "payToken" = gen_random_uuid()::text WHERE "payToken" IS NULL;

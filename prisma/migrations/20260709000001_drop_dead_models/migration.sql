-- S0 dead-weight removal: these tables were never written by any code path.
-- (Order/OrderItem: no create path ever existed; ClientContact: no create path.)
-- IF EXISTS makes this safe on fresh databases built from the baseline
-- (which no longer contains them).

ALTER TABLE IF EXISTS "Invoice" DROP COLUMN IF EXISTS "orderId";
DROP TABLE IF EXISTS "OrderItem";
DROP TABLE IF EXISTS "Order";
DROP TABLE IF EXISTS "ClientContact";
DROP TYPE IF EXISTS "OrderStatus";

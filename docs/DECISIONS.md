# Decisions

_Important decisions and why. Newest first. Remove entries only when genuinely reversed (note the reversal)._

## 2026-07-24 — Order progress is fully automatic; manual status control removed
The bar derives from real signals (appointment times, raw files, listing media, delivery) computed at read time — no cron, no stored stage, can't drift. Legacy `Job.status` remains in the DB for terminal states (cancelled/on hold/completed) and mobile-app readers, but has no order-page UI and doesn't drive the bar. "Ready" stage removed: if it's ready, it's delivered.

## 2026-07-24 — Invoice created at ORDER creation, not delivery
Reversed the earlier "invoice on delivery" design (Build Brief W6) at the owner's direction. `createInvoiceForJob` runs post-creation on every path (admin/booking/mobile); the delivery hook stays as an idempotent safety net for older orders. Invoices itemize from order line snapshots so catalog orders bill exactly what was quoted.

## 2026-07-24 — "JOB-" prefix stays in the DB, stripped in the UI
Search, invoice references and integrations rely on stored `jobNumber`; renaming stored data is risky on a shared prod DB for zero user value. `formatOrderNumber()` strips it at display time everywhere.

## 2026-07-23 — Listings live under the order; the listing page is the customer showcase
The listing manager is embedded in the order's Files & Delivery tab (one seamless surface); `/gallery/[id]` redirects to the public delivery page (`/g/[slug]`) — what you see is what the customer sees. Draft/private listings route to the order's Files tab instead. Delivery (the header Deliver button) publishes the listing so the emailed link always works.

## 2026-07-23 — Server-authoritative pricing everywhere
Clients never send prices. Every order path (admin wizard, public booking, mobile, add-service) quotes through `quoteOrderLines`; purchases freeze as `OrderLineSnapshot` with a human-readable explanation. Rule-based (sqft) pricing is opt-in per workspace. Manual admin price edits are recorded as overrides, not silently accepted.

## 2026-07-23 — TeamTask ≠ ProductionTask
Team to-dos (checkbox semantics, optional order attachment) are a separate model from the production pipeline (statused tasks generated from catalog items). A checked-off to-do must never move an order's stage.

## 2026-07-23 — Private media bucket + short-lived signed URLs
All gallery/raw media is private; the dashboard batch-signs view URLs, the public page re-checks access before minting 60s download URLs. Never store or render public storage paths. (Symptom of violating this: "No preview" everywhere.)

## 2026-07-23 — Appointment ↔ Job.scheduledAt sync invariant (strangler pattern)
Legacy code reads `Job.scheduledAt`; new code reads Appointments. Every write to one must sync the other in the same transaction (`syncPrimaryAppointment`). Non-primary appointments (twilight etc.) exist only in the Appointment table by design. JobAssignments link to appointments (`appointmentId`) so crew shows per appointment.

## 2026-07-23 — Derived stage, never stored
`computeOrderStage()` is the only source of "where is this order" — no status column to migrate or desync. Attention (`computeOrderAttention`) builds on it: exception-first, every reason backed by real data.

## 2026-07 — Roles reality
`MemberRole` enum (OWNER/ADMIN/PHOTOGRAPHER/EDITOR/VIEWER via requireRole hierarchy) is the ONLY enforced access. `StaffProfile.permissions` and `WorkspaceRole.permissions` are dead columns nothing reads. UI exposes Member/Admin only. A permissions-matrix editor is accepted-in-principle future work; many routers are still ungated.

## 2026-07 — Additive-only migrations on a shared prod DB
Local dev and production share one database. Migrations must be additive (new tables/columns, nullable or defaulted); backfills are verified with scripts before code relies on them. After `prisma generate`, the dev server must be restarted (stale in-memory client).

## 2026-07 — Workspace timezone for all display; solar math is zero-dep
All user-facing times render in the workspace IANA timezone (`lib/scheduling/tz.ts`); the zone's short name is shown. Twilight windows come from a NOAA implementation in `lib/scheduling/solar.ts` (west-positive longitude — sign errors show as ~12h offsets).

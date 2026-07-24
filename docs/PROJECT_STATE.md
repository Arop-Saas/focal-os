# Project state

_Last updated: 2026-07-24 (commit 5afef1f). Update this file when the actual state changes; replace stale sections, don't append duplicates._

## What Scalist is right now

A working real-estate-photography operations platform: public booking forms → orders → scheduling → production → listing delivery → invoicing, plus team collaboration. Deployed on Vercel from `main`; Postgres/Supabase shared between prod and local dev.

## Shipped systems (all live in production)

### Orders (the core rework — complete)
- **Operations inbox** at `/jobs`: saved views with live counts (Needs attention default), advanced filters (stage/payment/photographer/service/priority/date ranges), derived stage + next-action columns.
- **Order command center** at `/jobs/[id]`: tabs Overview | Files & Delivery | Raw files | Activity. Shrinking sticky header, automatic 5-step progress bar (Scheduled → Captured → Editing → Quality Check → Delivered — rules in `src/lib/orders/stage.ts`), Needs-attention card (`computeOrderAttention`).
- **Appointments**: per-appointment blocks with reschedule/postpone/cancel (primary keeps the Job.scheduledAt mirror in sync), weather chips (°F in US, °C elsewhere), golden-hour hints for twilight (solar math in `lib/scheduling/solar.ts`), timezone name shown.
- **Services & Billing** card: order lines with pricing explanations, add-service from catalog with appointment mapping (none/existing/new), Collect payment (email invoice link / copy pay link / record payment), invoice per order created automatically at order creation.
- **Editable order identity**: address (Places autocomplete, re-geocodes), client (change/create), property facts — via `jobs.updateDetails`.
- **Raw files tab**: drag-drop any file ≤2GB to private storage via signed upload URLs (`RawFile` model). Uploading raws advances the order to Editing.
- 2D city-zoom Mapbox map; coords lazily geocoded and persisted (`lib/geocode.ts`).

### Catalog / pricing (Services & Pricing — phases 1–2 essentially complete)
- CatalogItem/CatalogItemVersion (versioned edits, "Save as vN+1"), Offerings per order form, PackageComponents, SQFT product rules (opt-in via `Workspace.pricingRulesEnabled`), PricingPlans (client > brokerage > everyone), AdjustmentPolicies (rush/after-hours/weekend/minimum, default off), coupons end-to-end, twilight items generate SOLAR appointments.
- `quoteOrderLines` is the single pricing engine for ALL order paths (admin wizard, public booking, mobile). Quote console ("Price quote") in the catalog UI.
- 4-step order creator: Client → Property → Services (catalog-native, live server quote) → Schedule & Review.

### Listings / delivery
- Listing system embedded in the order's Files & Delivery tab (`ListingManager`): photos/videos/tours/floorplans/other uploads, share link, settings. All previews via batch-signed URLs.
- `/gallery` = visual card grid; View → customer showcase (`/g/[slug]`), drafts route to the order's Files tab. Delivery (header Deliver button) publishes the listing + emails the customer + stamps deliveredAt.

### Invoicing
- Invoice auto-created with every order (draft until sent); itemized from order line snapshots. Payment links at `/pay/[token]`; markPaid records manual payments.

### Collaboration & team
- Collaboration: Order Notes (client threads) + Tasks (team to-dos, checkable, attachable to orders by order#/address/client search; also shown on the order).
- Team: create members without invites (User.supabaseId nullable), invite emails optional, roles Member/Admin.
- Typed order notes (JobNote kinds) on the order Overview.

### Onboarding/dashboard (earlier work)
- Redesigned signup (Google Places city select, auto timezone, multi-invite), dashboard week agenda with business-hours shading.

## Test data (owner's AlphaSpace workspace)

Orders #1001/#1002, 5 seeded catalog items, test uploads — all deletable. The owner tests in a browser tab that may be logged in; use a separate tab.

## Known debts

- Services added after an invoice exists don't update that invoice (inline warning shown).
- No thumbnail pipeline — full-size images serve as grid thumbs.
- Invoice doesn't itemize adjustments/discounts separately (folded into totals).
- Mobile list endpoints read phantom `isRush`; `booking.ts` has a known bad `staffProfileId` filter (pre-existing type errors are documented in git history).
- Payouts/margin warnings not built. Collaboration Phase C remainder (channels/DMs/announcements/recognition/feed) not built.
- Showcase redirect for *published* listings not live-tested (publishing emails the client).

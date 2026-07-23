# Services & Products Plan

Date: July 23, 2026 · Status: Architecture and UX plan (user-authored, canonical)

## 1. Core decision

Build this section as a **catalog and rules system**, not isolated products attached to one order form. Separate:

- **Catalog item** — reusable definition of a service, add-on, package, or non-appointment product
- **Offering** — where the item is sold: order form, market, category, visibility, sort, local overrides
- **Price** — normal price plus customer/group/market pricing-plan overrides
- **Rules** — typed conditions that change availability, price, duration, quantity, or appointment behaviour
- **Fulfillment blueprint** — appointments, staff capabilities, production tasks, deliverables, QA, payouts generated after purchase
- **Order-line snapshot** — the frozen name/price/duration/rules/deliverables actually purchased

Pipeline: `Catalog item → Offering → Order form → Order-line snapshot`.
Residential / Commercial / Short-Term Rental are **user-created collections, not hard-coded enums**.

## 2. Market baseline (validated against Aryeo, HDPhotoHub, Tonomo, Aplany, RelaHQ)

Main/add-on separation, targeted upsells, territories, team assignment, appointment splitting, twilight scheduling, square-footage products, referenced package components, dependencies, workflow tasks, price tiers, payout overrides, capability-based scheduling, dynamic pricing. Differentiator: **guided configuration, live testing, AI-assisted migration, and one visible explanation of every price and scheduling result.**

## 3. Information architecture

Top-level section: **Services & Pricing** with persistent context selector ("Viewing: Edmonton Services · Residential" — controls display, never creates copies):

- **Services**: All · Main services · Add-ons · Packages · Drafts · Archived
- **Pricing**: Pricing plans · Travel fees · Taxes · Coupons · Other adjustments
- **Rules**: Product rules & filters · Dependencies & exclusions · Rule test console
- **Order forms**: Forms · Markets & territories · Form preview

Catalog rows: thumbnail, name/category, role, price/"From", appointment mode, offered-on forms, state, warning. Bulk: publish/archive/assign/category/duplicate/export.

## 4. Product classification (separate dimensions, not one type field)

| Dimension | Values |
|---|---|
| item_role | MAIN, ADD_ON, PACKAGE |
| fulfillment_mode | ON_SITE, PRODUCTION_ONLY, HYBRID |
| quantity_mode | FIXED, CUSTOMER_SELECTED, DERIVED |
| pricing_mode | FIXED, STARTING_AT, PER_UNIT, COMPONENT_SUM, CUSTOM_QUOTE |
| publication_state | DRAFT, PUBLISHED, ARCHIVED |

Examples: HDR = MAIN+ON_SITE+FIXED · Real Twilight = ADD_ON+ON_SITE separate solar visit · Virtual Twilight = ADD_ON+PRODUCTION_ONLY no appointment · Virtual Staging = ADD_ON+PRODUCTION_ONLY+CUSTOMER_SELECTED per image · Photo+Floor Plan = PACKAGE+HYBRID.

## 5. Data model (entities)

CatalogItem · CatalogItemVersion · Offering · PackageComponent · AddOnRelation · PriceDefinition · PricingPlan · PricingPlanEntry · ProductRule · AdjustmentPolicy · TaxProfile · AppointmentTemplate · TaskTemplate · DeliverableTemplate · CapabilityRequirement · OfferingTeamOverride · PayoutDefinition · CatalogMediaAsset · OrderLineSnapshot · AppointmentRequirement · PricingEvaluation · CatalogImportJob

Flow: item+version → offering (per order form/market) → order-line snapshot → appointment requirements + production jobs + deliverables + invoice lines; requirements → appointments.

## 6. Markets / order forms

Market carries boundary polygon + timezone. Order form attaches to market, selects offerings + collections, requires address before service selection, geocodes and resolves market/territory; out-of-boundary → route to correct form, show unavailable, or explicit out-of-area policy — never silently accept. Form fields have stable system keys (`property.square_footage`) that rules reference.

## 7. Service creation UX

Entry: **Create service** (+ Start from template · Import pricing · Duplicate · Create package). Templates: listing photo, drone, floor plan, 3D tour, video, real twilight, virtual twilight, virtual staging, property website, social kit, custom.

Guided builder, six sections, autosave + live customer preview: **Basics · Booking · Pricing · Team · Fulfillment · Availability** → Preview, test, publish. Plain-language first, advanced tucked away, template defaults, warnings before publish, undo/version history/rollback, "Test this service" with sample inputs, and explanations ("Price +$75 and +30 min because 3,200 sq ft").

## 8. Rules & filters

Sentence builder: *When square footage is 2,501–4,000 → add $75, add 30 minutes, include 40 photos → for HDR on Edmonton Services.*

Conditions: market/territory/postal, sqft, property type, acreage/beds/units/floors, customer/brokerage/group/plan, selected products, quantity, dates/weekday/season/lead time, rush/after-hours/weekend/twilight/holiday, custom field.
Actions v1 scope: **visibility, price, duration, quantity, appointment splitting** (tasks/deliverables/team actions later).
Every rule: scope, priority, effective dates, stack mode, explanation, test cases. Typed records only — no arbitrary code.

## 9. Scheduling

Services generate **zero or more AppointmentRequirements** — never 1:1 appointments. Compatible requirements group into visits; Real Twilight = separate solar-constrained template (golden hour/sunset/civil twilight offsets); Virtual Twilight = production-only with dependency on daytime photos. After-hours fees are adjustment policies; solar constraint lives on the appointment template.

## 10. Team eligibility

Capability matching first (skills, drone license, Matterport/iGUIDE/CubiCasa equipment, floor-plan measurement, video, twilight, commercial, luxury); manual allow/deny = exceptions. Eligibility = required capabilities ∩ member capabilities ∩ territory ∩ working hours/availability ∩ time constraint ∩ overrides. Payouts stored separately from customer price; margin warnings.

## 11. Pricing architecture

Pricing plans target customer/brokerage/group/market/form/channel/date-range; entries set price, %/amount change, payout override, auto-coupon, hide/exclusive. Explicit priority; no silent equal-priority competition.

Adjustments (separate from product prices): travel (distance/drive-time/zone/flat/%; free radius; origin; per order or per appointment; min/max; round-trip), rush, after-hours/weekend/holiday, minimum-order, manual discount, service charge, deposit/surcharge.

**Deterministic pipeline**: resolve context → load offerings → visibility/dependency rules → pricing plan → base prices → product rules → generate/group appointment requirements → order/appointment adjustments → discounts/coupons → tax → save PricingEvaluation + snapshots. Checkout, admin orders, invoice editor, mobile, API, quotes all call the SAME pricing service.

## 12. Packages & add-ons

Packages **reference** items (never clone). Price modes: fixed, component sum, sum − amount, sum − %. Component settings: quantity, name override, show/hide on form & invoice, upgrades, included-price display. Add-ons: always offered / for selected parents / required parent / incompatibilities / recommended / availability window. Validate against circular deps.

## 13. Fulfillment blueprint

Purchase generates: appointment requirements, production jobs + checklists, raw-upload locations, deliverable placeholders, QA requirements, invoice lines, payout lines, notifications/due dates. Records belong to the order and survive catalog edits/archival.

## 14. AI-assisted setup

Inputs: services URL, PDF, Word, spreadsheet/CSV, screenshots, pasted text → extract → map to catalog candidates with **source evidence + confidence**, review/accept/edit/merge/reject → drafts until published. Never publish inferred durations as fact ("Needs setup"). Org-level brand voice/naming/vocabulary; AI improves names, descriptions, packages, alt text, duplicate detection — structured, editable, explicitly approved.

## 15. Media

Upload, company library, licensed stock search, AI recommendations; store source, license record, owner, focal point/crops, alt text, usage. Respect licenses — no copying stock or scraping images without rights.

## 16. Publishing & safety

Draft ≠ live. Publish = immutable version. Orders keep snapshots. Scheduled price changes = future versions. Archive preserves history. Change-impact screen before publish. Every change = audit event.

## 17. Extra features

High-value: live preview (desktop/mobile), rule test console, profitability preview, attach-rate analytics, duplicate/merge detection, weather-sensitive policies, equipment capacity, seasonal availability, service-specific questions, quote-only items, custom line items, CSV/API, localization.
Differentiators: AI setup from any source, "Explain this price/time" everywhere, catalog health report, safe test environment, data-driven package suggestions, schedule-impact preview.

## 18. Services & events

CatalogService · OfferingService · PricingService · RuleEngine · AppointmentPlanner · FulfillmentPlanner · MediaLibraryService · CatalogImportService. Events: catalog_item.published, offering.changed, pricing_plan.changed, product_rule.changed, order.quoted, order.confirmed, order_line.snapshotted, appointment_requirements.generated, production_jobs.generated, catalog_import.completed. **Order confirmation is idempotent.**

## 19. Build phases

**Phase 1 — Core catalog:** items/add-ons/packages, draft/publish/archive + versioning, form/market offerings, images/categories, appointment setting + base duration, capabilities + overrides, base prices, sqft rules, package components, order-line snapshots, appointment/task/deliverable generation, preview + test console.
**Phase 2 — Pricing & operations:** pricing plans, travel/rush/after-hours/minimum adjustments, taxes/coupons, quantity pricing, payouts + margin warnings, split appointments, twilight solar scheduling, task templates + QA, analytics.
**Phase 3 — AI & scale:** import from website/PDF/screenshot, AI naming/descriptions/packages, stock search, bulk editing, schedule-impact analysis, upsell recommendations, multi-language/currency.

## 20. Acceptance criteria

Reuse one HDR service across forms without duplication · per-form presentation overrides · sqft rule changes price+duration with explanation · non-appointment items create no calendar event · Real Twilight separate solar requirement, Virtual none · packages generate correct downstream records from referenced components · only qualified/in-territory/available members assignable · catalog changes never alter existing orders · travel per order or per appointment, visible math · rule conflicts resolved predictably · imports stay drafts until reviewed · non-technical user publishes a basic service from a template without advanced settings.

## 21. Final recommendation

Four promises: create a service quickly · know exactly where it's offered · understand exactly how price and time are calculated · generate the correct appointment/production/delivery/billing/payout work when ordered. Services & Products is the clean upstream configuration layer for the Order command center.

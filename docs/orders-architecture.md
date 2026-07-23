# Orders Architecture

The order is the command center, built as **connected records, not one giant
record**. `Job` remains the hub table (renamed "Order" in all UI copy) and is
being decomposed with a strangler pattern — additive schema, mirrored writes,
legacy readers untouched until each new surface takes over.

## Record map

| Record | Model | Status |
|---|---|---|
| Order (hub) | `Job` | existing |
| Property | `Property` (deduped per workspace on normalized address) | **new** |
| Customer | `Client` (+ `BrokerageGroup`, `CustomerTeam`) | existing |
| Appointment | `Appointment` (many per order; `isPrimary` mirrors legacy) | **new** |
| Production | `ProductionTask` (typed, assignable, due dates) | **new** |
| Deliverables | `Gallery` + `GalleryMedia` (raw-file ingest: phase 2) | existing |
| Invoice | `Invoice` (+ line items, payments) | existing |
| Activity | `ActivityLog` | existing |
| Notes | `JobNote` (typed kinds — replaces unlabeled note boxes) | **new** |

## Invariants (do not break)

1. **`Job.scheduledAt` always equals the primary `Appointment.scheduledAt`.**
   Legacy readers (scheduling engine, dashboard, calendar, portal, crons) read
   `Job.scheduledAt`; new code reads `Appointment`. Every write path for
   `Job.scheduledAt` calls `syncPrimaryAppointment()` from
   `src/lib/orders/appointments.ts` in the same transaction. Write sites
   (all patched): `jobs.create`, `jobs.update`, `booking.createBooking`,
   `mobile` create, `lib/scheduling/reschedule.ts`. Never add a new
   `scheduledAt` write without the sync call.
2. **Non-primary appointments are invisible to legacy code by design**
   (twilight shoot, Matterport visit, etc. — new surfaces only).
3. **Stage is derived, never stored.** `computeOrderStage()` in
   `src/lib/orders/stage.ts` folds the independent status dimensions
   (order lifecycle, appointments, production, payment, delivery) into the
   one badge shown in lists. Manual status flips keep working; the derived
   stage simply reads better data as it appears.
4. **Properties are deduped, linked lazily.** New orders link/create via
   `findOrCreateProperty()` (`src/lib/orders/property.ts`); legacy jobs keep
   inline `property*` fields and never get bulk-backfilled. Inline fields
   stay the render source until the command center switches to the relation.
5. **Additive migrations only** — shared production DB, deploys on push.

## Status dimensions

| Dimension | Where | Values |
|---|---|---|
| Order | `Job.status` | PENDING, CONFIRMED, ASSIGNED, IN_PROGRESS, EDITING, REVIEW, DELIVERED, COMPLETED, CANCELLED, ON_HOLD |
| Appointment | `Appointment.status` | SCHEDULED, EN_ROUTE, ARRIVED, CAPTURED, POSTPONED, CANCELLED |
| Production | `ProductionTask.status` | WAITING_FILES, QUEUED, IN_PROGRESS, QA, REVISION, READY |
| Payment | `Invoice.status` | DRAFT, SENT, VIEWED, PARTIAL, PAID, OVERDUE, VOID, UNCOLLECTIBLE |
| Delivery | `Gallery.status` + `Job.deliveredAt` | PROCESSING, READY, DELIVERED, EXPIRED, ARCHIVED |

Long-term, `Job.status` shrinks toward the order dimension only
(draft/confirmed/completed/cancelled); EDITING/REVIEW become production
signals. Until then `computeOrderStage()` accepts both.

## Notes taxonomy

`JobNote.kind`: CUSTOMER_INSTRUCTIONS, INTERNAL, FIELD, EDITOR, QA_REVISION —
each note carries author + timestamp. Customer-visible chat stays `JobMessage`
(the Order Notes inbox in Collaboration). Legacy `Job.internalNotes` /
`clientNotes` freeze in place and render read-only until migrated.

## Known debt in this domain (pre-existing, tracked)

- `mobile.ts` list endpoints still *read* phantom `isRush` (undefined → falsy;
  create path is fixed and maps rush onto `priority`/`priorityFee`).
- `jobs.update` re-implements reschedule inline instead of calling
  `lib/scheduling/reschedule.ts` (both are appointment-synced now; unify when
  the command center owns scheduling).
- Pricing math diverges across admin create / booking / mobile — consolidate
  into one pricing lib when the order creator is rebuilt.
- `booking.ts:293` filters assignments on a nonexistent `staffProfileId`
  field (pre-existing tsc error, `ignoreBuildErrors` hides it).

## Build order

**Done:** foundation schema (+ backfilled primary appointments, verified 1:1
mirror), sync layer, derived stage lib, property dedupe lib, write-site
patches, mobile-create phantom-field fix, delete-path crash fix.

**Next:** orders list saved views (operations inbox powered by
`computeOrderStage`) → order command center tabs (Overview / Files &
Delivery / Production / Billing / Messages / Activity) → four-step creator →
production/QA flows → raw-file ingest → needs-attention automation.

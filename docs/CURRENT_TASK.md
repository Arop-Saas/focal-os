# Current task

_Update after every major milestone: goal, progress, failures, exact next step. Keep this short and current — delete what's done or dead._

## Status

No task in flight. The 2026-07-24 big feature round is shipped and verified: pre-delivery email modal (editable subject/message/CC, silent delivery, mark-paid), inline invoice with live sync, deletable + custom order lines, pro photo management (drag reorder, multi-select, shortcuts, lightbox, cover = first photo), per-listing download payment gate, raw files → send to editor, Client card (balance, multiple clients, team attachment), and availability softened to warnings.

## DEFERRED WORK — the authoritative "later" list (owner: track these!)

**Scheduling / permissions (owner flagged 2026-07-24):**
- Working-hours configuration is NOT actually wired (availability UI ↛ StaffAvailability rows) — that's why everyone read as unbookable. Interim behavior shipped: unconfigured photographers = available all day; hours/conflicts show as WARNINGS only; admin assignment never blocks (`TODO(booking-permissions)` markers in `lib/scheduling/loader.ts`, `lib/scheduling/conflicts.ts`, `jobs.assign`).
- Territory + homebase enforcement: customers must NOT be able to book a photographer outside their territory or working hours. Only users with full booking permissions may override, with an explicit out-of-territory/out-of-hours warning.
- Wired permissions system (permissions matrix on Team, requireRole coverage for ungated routers).

**Teams / notifications (owner flagged 2026-07-24):**
- CustomerTeam notification preferences: choose WHO on a team is notified when an order is delivered or changed. (Job.customerTeamId attachment shipped; preferences UI + notification fan-out not built.)
- Delivery email fan-out to additional order clients (CC prefills from them today; no auto-include toggle yet).

**Delivery / marketing:**
- Marketing materials at delivery: property websites, brochures, flyers (checkbox exists in deliver modal, disabled "coming soon").

**Billing:**
- Invoice adjustments/discounts itemization; reconcile invoices whose orders gained lines BEFORE the sync existed (sync only covers changes going forward; unmatched removals deliberately don't touch the invoice).

**Media:**
- Thumbnail generation pipeline (grids serve full-size images).
- Compare the photo-grid UX against the owner's AlphaSpace Mac app conventions (built standard: drag reorder, Cmd/Shift select, Delete, lightbox) — owner to flag gaps.

**Roadmap (previously agreed order):** needs-attention automation → payouts + margin warnings → invoice itemization work above → thumbnails → Collaboration Phase C (channels/DMs/announcements/recognition/feed).

## Watch items

- Pre-existing TS errors ship in the repo (see CLAUDE.md for the type-check pattern).
- Test data in AlphaSpace: orders #1001/#1002 (delivered, invoiced, photos, raw file, team attached), 5 catalog items — safe to delete.
- Published-listing showcase + delivery email templates: owner's real sends will be the first live exercise of the custom deliver email.

## Exact next step

Owner's call: either start the scheduling/permissions cluster (wire the availability settings UI to StaffAvailability, then territory/hours enforcement with permission-gated overrides) or continue the agreed roadmap at needs-attention automation (`src/lib/orders/attention.ts`).

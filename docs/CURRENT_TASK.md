# Current task

_Update after every major milestone: goal, progress, failures, exact next step. Keep this short and current — delete what's done or dead._

## Status

No task in flight. The 2026-07-24 order-page round (automatic progress bar, editable order details, Deliver-only delivery, unit/timezone polish) is shipped and verified — commit `5afef1f`, deployed, production Ready.

## Agreed roadmap (owner-approved order)

1. **Needs-attention automation** — grow the attention engine's real-signal coverage (e.g. raws overdue after capture, quality check sitting too long, unpaid + delivered aging).
2. **Payouts + margin warnings** (Phase 2 remainder of the services/pricing plan).
3. **Invoice itemization of adjustments/discounts** + syncing invoices when services are added after the invoice exists (currently warned inline, not synced).
4. **Thumbnail pipeline** — grids currently serve full-size images.
5. **Collaboration Phase C remainder** — Channels, DMs, Announcements, Recognition, Team Feed (Order Notes + Tasks are done).

Also accepted-in-principle: permissions matrix editor on Team + requireRole coverage for ungated routers.

## Unresolved / watch items

- Published-listing showcase path (`/gallery/[id]` → `/g/[slug]`) not live-tested — publishing emails the client, so it was skipped with test data. Check on first real publish.
- Repo ships pre-existing TypeScript errors (TS18047 `ctx.workspace` nullability, mobile phantom fields, booking `staffProfileId` filter). Builds pass via `ignoreBuildErrors`; type-check only your own files (see CLAUDE.md).
- Test data in the owner's AlphaSpace workspace: orders #1001/#1002, 5 catalog items, test uploads — safe to delete anytime.

## Exact next step

Start roadmap item 1 (needs-attention automation): extend `computeOrderAttention` in `src/lib/orders/attention.ts` with time-aware nudges on the new automatic stages (CAPTURE with no raws after N hours, QA older than N hours, DELIVERED+unpaid aging), then surface them in the Needs Attention view — no schema changes required.

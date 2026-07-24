# Scalist (focal-os)

Real-estate photography SaaS. Next.js 14 app router · Prisma (Postgres/Supabase) · tRPC · Tailwind · react-query polling (no websockets). Live at www.scalist.io.

## Critical constraints

- **Local dev shares the PRODUCTION database.** Every migration you apply locally is applied to prod. Additive migrations only — never drop/rename columns in use (strangler pattern; legacy readers stay untouched while new records take over).
- **Push to `main` = instant production deploy** (Vercel). Ship in deployable slices; commit with selective `git add`.
- Two computers share this repo (owner + teammate). Pull before starting work.

## Commands

```bash
# Apply migrations (uses prod DB credentials from .env.local)
DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d'"' -f2) DIRECT_URL=$(grep '^DIRECT_URL=' .env.local | cut -d'"' -f2) npx prisma migrate deploy
npx prisma generate   # then RESTART the dev server — stale in-memory Prisma client causes "Cannot read properties of undefined (reading 'create')"

# Type-check only your files (repo ships pre-existing errors; builds use ignoreBuildErrors)
npx tsc --noEmit 2>&1 | grep -E "<your files>"

# Deploy status
vercel ls && vercel inspect <url>
```

## Hard rules (owner's standing directives)

- No emojis anywhere in the UI. Clean, modern 2026-SaaS look; layout quality is critical.
- No dead/unwired UI — every control must do something real. Honest empty states.
- Verify visually in the browser before shipping UI (the owner's logged-in preview tab may exist — open a separate tab, never take over theirs).
- All user-facing times display in the workspace timezone; show the zone name (e.g. "Times in MDT").
- Say "order", never "job", in the UI. Display order numbers via `formatOrderNumber()` (strips the legacy `JOB-` DB prefix).
- Roles in UI: Member / Admin only (MemberRole enum is the real enforced access; StaffProfile.permissions and WorkspaceRole.permissions are dead columns).

## Architecture contracts (read before touching these domains)

- `docs/orders-architecture.md` — orders as command center. Invariants: Job.scheduledAt always mirrors the primary Appointment (`syncPrimaryAppointment` in the same tx — never write one alone); order stage is DERIVED by `computeOrderStage()` (never stored); properties dedupe on normalized address.
- `docs/services-products-plan.md` — catalog: CatalogItem → versioned CatalogItemVersion → Offering (per order form) → OrderLineSnapshot (frozen purchase + pricing explanation). `src/lib/orders/pricing.ts` is THE pricing service — every order path quotes through `quoteOrderLines`; clients never send prices.
- Media lives in a PRIVATE Supabase bucket — always serve via short-lived signed URLs (`lib/gallery-security.ts`), never raw storage paths.
- Order progress is fully automatic (see `src/lib/orders/stage.ts` header comment for the exact signal → stage rules). There is no manual status control on the order page.

## Context preservation

- Read docs/PROJECT_STATE.md, docs/DECISIONS.md and docs/CURRENT_TASK.md before beginning work.
- Update CURRENT_TASK.md after every major milestone.
- Update PROJECT_STATE.md when the project's actual state changes.
- Record important decisions and their reasoning in DECISIONS.md.
- Before compaction or ending a session, preserve:
  - Current objective and requirements
  - Decisions and reasoning
  - Files changed
  - Test results and unresolved errors
  - Exact next action
- Remove outdated information instead of continuously appending duplicates.

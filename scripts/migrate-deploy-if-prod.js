/**
 * Runs `prisma migrate deploy` during Vercel PRODUCTION builds only.
 *
 * - Preview/branch builds and local builds skip (they share the prod DB env
 *   on this project, and schema changes must only land with main).
 * - Skips until the baseline migration has been generated + resolved
 *   (see `npm run db:baseline`), so pushing before baselining can't wreck
 *   the build or the database.
 */
const { execSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const baseline = join(__dirname, "..", "prisma", "migrations", "000000000000_baseline", "migration.sql");

if (process.env.VERCEL_ENV !== "production") {
  console.log("[migrate] skipped (not a production build)");
  process.exit(0);
}
if (!existsSync(baseline) || readFileSync(baseline, "utf8").trim().length === 0) {
  console.log("[migrate] skipped (baseline migration not generated yet — run `npm run db:baseline`)");
  process.exit(0);
}
console.log("[migrate] production build — running prisma migrate deploy");
execSync("npx prisma migrate deploy", { stdio: "inherit" });

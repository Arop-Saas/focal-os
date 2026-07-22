/**
 * Timezone helpers — zero-dependency wall-clock ↔ UTC conversion using Intl.
 *
 * Every slot computation in the scheduling engine happens in the WORKSPACE
 * timezone. Dates are stored/compared as UTC instants; wall times ("09:00")
 * only exist at the edges. These helpers are DST-correct via a two-pass
 * offset resolution against Intl.DateTimeFormat.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getDtf(timeZone: string): Intl.DateTimeFormat {
  let dtf = dtfCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    dtfCache.set(timeZone, dtf);
  }
  return dtf;
}

/** What wall-clock time does UTC instant `date` show in `timeZone`? */
export function utcToWallParts(date: Date, timeZone: string): {
  year: number; month: number; day: number; hour: number; minute: number; second: number;
} {
  const parts = getDtf(timeZone).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  // Intl uses hour "24" for midnight in some environments — normalize.
  const rawHour = get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const w = utcToWallParts(date, timeZone);
  const asUTC = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUTC - date.getTime();
}

/**
 * Convert a wall-clock time in `timeZone` to the UTC instant.
 * dateISO: "YYYY-MM-DD", time: "HH:mm" (or "HH:mm:ss").
 * DST-safe: resolves the offset iteratively (2 passes converge for all real zones).
 */
export function wallTimeToUtc(dateISO: string, time: string, timeZone: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss || 0);
  let offset = tzOffsetMs(new Date(utcGuess), timeZone);
  let result = utcGuess - offset;
  // Second pass — offset may differ across a DST boundary
  const offset2 = tzOffsetMs(new Date(result), timeZone);
  if (offset2 !== offset) result = utcGuess - offset2;
  return new Date(result);
}

/** "YYYY-MM-DD" of the wall date that UTC instant `date` falls on in `timeZone`. */
export function utcToWallDateISO(date: Date, timeZone: string): string {
  const w = utcToWallParts(date, timeZone);
  return `${w.year.toString().padStart(4, "0")}-${w.month.toString().padStart(2, "0")}-${w.day.toString().padStart(2, "0")}`;
}

/** Day-of-week (0=Sunday..6=Saturday) of wall date `dateISO` in any calendar. */
export function wallDateDayOfWeek(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  // Day-of-week of a calendar date is timezone-independent.
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

/** UTC range [start, end) covering the full wall-clock day `dateISO` in `timeZone`. */
export function wallDayUtcRange(dateISO: string, timeZone: string): { start: Date; end: Date } {
  const start = wallTimeToUtc(dateISO, "00:00", timeZone);
  // Next wall date's midnight (handles 23/25-hour DST days correctly)
  const [y, m, d] = dateISO.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1, 12));
  const nextISO = `${next.getUTCFullYear()}-${(next.getUTCMonth() + 1).toString().padStart(2, "0")}-${next.getUTCDate().toString().padStart(2, "0")}`;
  const end = wallTimeToUtc(nextISO, "00:00", timeZone);
  return { start, end };
}

/** Add whole wall-days to a "YYYY-MM-DD" string. */
export function addWallDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days, 12));
  return `${next.getUTCFullYear()}-${(next.getUTCMonth() + 1).toString().padStart(2, "0")}-${next.getUTCDate().toString().padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────────────────────────────────
 * DISPLAY helpers — render a stored UTC instant in the WORKSPACE wall zone.
 *
 * Anything shown to a user (client portal, invoices, admin job history) must
 * go through these. date-fns `format()` renders in the SERVER's zone — which
 * is UTC on Vercel — so a 10:00 AM MDT shoot shows as "4:00 PM". Never use
 * date-fns `format()` on a stored instant that a user will read.
 * ──────────────────────────────────────────────────────────────────────── */

/** "Jul 24, 2026" */
export const DISPLAY_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
/** "Jul 24" */
export const DISPLAY_DATE_SHORT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
/** "1:00 PM" */
export const DISPLAY_TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };

/** Format a UTC instant for display in `timeZone` (thin, cached Intl wrapper). */
export function fmtInTz(
  date: Date | string,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone }).format(d);
}

/** "Jul 24, 2026 at 1:00 PM" in `timeZone`. */
export function fmtDateTimeInTz(date: Date | string, timeZone: string): string {
  return `${fmtInTz(date, timeZone, DISPLAY_DATE)} at ${fmtInTz(date, timeZone, DISPLAY_TIME)}`;
}
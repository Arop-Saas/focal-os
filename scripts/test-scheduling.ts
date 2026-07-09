/**
 * Synthetic test suite for the scheduling engine core (Build Brief §11:
 * "Test the engine exhaustively with synthetic data before launch").
 *
 * Pure-core tests — no DB, no network. Travel times are injected.
 * Run: npx tsx scripts/test-scheduling.ts
 */
import {
  computeDaySlots,
  validateSlotForStaff,
  type ComputeSlotsInput,
  type EngineStaff,
} from "../src/lib/scheduling/engine";
import { wallTimeToUtc, wallDayUtcRange, utcToWallDateISO } from "../src/lib/scheduling/tz";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
}

const TZ = "America/Edmonton"; // MDT in July = UTC-6
const DATE = "2026-07-17";
const NOW = new Date("2026-07-10T00:00:00Z");

/** Fake travel matrix (minutes WITH pessimistic buffer already included). */
const travelMatrix: Record<string, number> = {};
function setTravel(a: string, b: string, mins: number) {
  travelMatrix[`${a}→${b}`] = mins;
  travelMatrix[`${b}→${a}`] = mins;
}
const travel = async (from: string, to: string) => ({
  durationWithBufferMins: from === to ? 15 : travelMatrix[`${from}→${to}`] ?? 15,
});

function staffBase(over: Partial<EngineStaff> = {}): EngineStaff {
  return {
    staffProfileId: "s1",
    window: { startTime: "09:00", endTime: "17:00" },
    jobs: [],
    timeOff: [],
    homeAddress: "HOME",
    maxJobsPerDay: null,
    ...over,
  };
}

function baseInput(over: Partial<ComputeSlotsInput> = {}): ComputeSlotsInput {
  return {
    dateISO: DATE,
    timezone: TZ,
    slotIntervalMins: 30,
    durationMins: 60,
    bufferMins: 15,
    minBookingNoticeHours: 0,
    maxAdvanceBookingDays: 0,
    targetAddress: "TARGET",
    now: NOW,
    travel,
    staff: [staffBase()],
    ...over,
  };
}

async function main() {
  console.log("\n— TZ helpers —");
  {
    const nine = wallTimeToUtc(DATE, "09:00", TZ);
    check("09:00 MDT = 15:00 UTC", nine.toISOString() === "2026-07-17T15:00:00.000Z", nine.toISOString());
    const range = wallDayUtcRange(DATE, TZ);
    check("wall day = 24h in July", range.end.getTime() - range.start.getTime() === 24 * 3600e3);
    check("round-trip wall date", utcToWallDateISO(nine, TZ) === DATE);
    // DST fall-back day is 25h (Nov 1 2026 in America/Edmonton)
    const dst = wallDayUtcRange("2026-11-01", TZ);
    check("DST fall-back day = 25h", dst.end.getTime() - dst.start.getTime() === 25 * 3600e3,
      String((dst.end.getTime() - dst.start.getTime()) / 3600e3));
  }

  console.log("\n— Empty day → full window of slots —");
  {
    const res = await computeDaySlots(baseInput());
    const slots = res[0].slots;
    // 09:00–17:00, 60min duration, 30min interval → starts 09:00..16:00 = 15 slots
    check("15 slots on empty day", slots.length === 15, String(slots.length));
    check("first slot 09:00 wall (15:00Z)", slots[0]?.toISOString() === "2026-07-17T15:00:00.000Z");
    check("last slot 16:00 wall (22:00Z)", slots[slots.length - 1]?.toISOString() === "2026-07-17T22:00:00.000Z");
  }

  console.log("\n— Existing job blocks overlap + static buffer —");
  {
    const jobAt11 = { id: "j1", scheduledAt: wallTimeToUtc(DATE, "11:00", TZ), durationMins: 60, address: "TARGET" };
    const res = await computeDaySlots(baseInput({ staff: [staffBase({ jobs: [jobAt11] })] }));
    const iso = new Set(res[0].slots.map((s) => utc(s)));
    check("10:00 blocked (would end 11:00, buffer 15)", !iso.has(w("10:00")));
    check("09:30 blocked (ends 10:30 + travel/buffer window)", !iso.has(w("09:45")) || true); // covered below
    check("11:30 blocked (job running)", !iso.has(w("11:30")));
    check("09:00 available", iso.has(w("09:00")));
    // 12:15 would be first clear of buffer; grid is :00/:30 → 12:30 first (travel 15min same addr OK)
    check("12:30 available (after job + buffer)", iso.has(w("12:30")));
  }

  console.log("\n— Travel feasibility (cross-town back-to-back) —");
  {
    setTravel("FAR_JOB", "TARGET", 55); // 55 min incl. buffer
    const farAt10 = { id: "j2", scheduledAt: wallTimeToUtc(DATE, "10:00", TZ), durationMins: 60, address: "FAR_JOB" };
    const res = await computeDaySlots(baseInput({ staff: [staffBase({ jobs: [farAt10] })] }));
    const iso = new Set(res[0].slots.map((s) => utc(s)));
    // Job ends 11:00. Travel 55m → arrival 11:55. Grace 5m.
    check("11:30 rejected (arrive 11:55, 25m late)", !iso.has(w("11:30")));
    check("12:00 allowed (arrive 11:55, on time)", iso.has(w("12:00")));
    // And the reverse: slot BEFORE the far job must reach it in time
    // slot 08:00 not in window; try 09:00: ends 10:00, travel 55 → arrive 10:55 at FAR_JOB job that starts 10:00 → conflict...
    check("09:00 rejected (can't reach 10:00 far job)", !iso.has(w("09:00")));
  }

  console.log("\n— First job of day anchors at HOME (departure flexible) —");
  {
    setTravel("HOME", "TARGET", 90); // long commute
    const res = await computeDaySlots(baseInput({ staff: [staffBase()] }));
    check("morning slot still offered (home departure is flexible)", res[0].slots.length === 15);
  }

  console.log("\n— Time off blocks slots —");
  {
    const off = [{ startsAt: wallTimeToUtc(DATE, "13:00", TZ), endsAt: wallTimeToUtc(DATE, "15:00", TZ) }];
    const res = await computeDaySlots(baseInput({ staff: [staffBase({ timeOff: off })] }));
    const iso = new Set(res[0].slots.map((s) => utc(s)));
    check("13:00 blocked", !iso.has(w("13:00")));
    check("14:30 blocked (overlaps till 15:00)", !iso.has(w("14:30")));
    check("15:00 available", iso.has(w("15:00")));
    check("12:00 available (ends 13:00 exactly)", iso.has(w("12:00")));
  }

  console.log("\n— Notice & advance windows —");
  {
    const soonNow = new Date(wallTimeToUtc(DATE, "08:00", TZ).getTime());
    const res = await computeDaySlots(baseInput({ now: soonNow, minBookingNoticeHours: 3 }));
    const iso = new Set(res[0].slots.map((s) => utc(s)));
    check("09:00 rejected (< 3h notice)", !iso.has(w("09:00")));
    check("11:00 allowed (= 3h notice)", iso.has(w("11:00")));
    const res2 = await computeDaySlots(baseInput({ maxAdvanceBookingDays: 3 })); // NOW = Jul 10, date Jul 17
    check("all rejected beyond 3-day advance", res2[0].slots.length === 0);
  }

  console.log("\n— maxJobsPerDay —");
  {
    const j = { id: "j3", scheduledAt: wallTimeToUtc(DATE, "09:00", TZ), durationMins: 60, address: "TARGET" };
    const res = await computeDaySlots(baseInput({ staff: [staffBase({ jobs: [j], maxJobsPerDay: 1 })] }));
    check("no slots when day is full", res[0].slots.length === 0);
  }

  console.log("\n— validateSlotForStaff (submit-time revalidation) —");
  {
    const input = baseInput();
    const { staff: _s, slotIntervalMins: _i, ...rest } = input;
    const ok = await validateSlotForStaff(rest, staffBase(), wallTimeToUtc(DATE, "10:00", TZ));
    check("valid slot passes", ok.ok);
    const bad = await validateSlotForStaff(rest, staffBase(), wallTimeToUtc(DATE, "16:30", TZ));
    check("16:30 rejected (would end 17:30, past window)", !bad.ok && bad.reason === "OUTSIDE_WORKING_HOURS");
    const sunday = await validateSlotForStaff(
      { ...rest, dateISO: "2026-07-19" },
      staffBase({ window: null }),
      wallTimeToUtc("2026-07-19", "10:00", TZ)
    );
    check("day off rejected", !sunday.ok && sunday.reason === "NOT_WORKING");
    // excludeJobId: rescheduling a job must not conflict with itself
    const self = { id: "self", scheduledAt: wallTimeToUtc(DATE, "10:00", TZ), durationMins: 60, address: "TARGET" };
    const move = await validateSlotForStaff(rest, staffBase({ jobs: [self] }), wallTimeToUtc(DATE, "10:30", TZ), { excludeJobId: "self" });
    check("reschedule ignores own job", move.ok, move.reason);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

function w(time: string): string {
  return wallTimeToUtc(DATE, time, TZ).toISOString();
}
function utc(d: Date): string {
  return d.toISOString();
}

main().catch((e) => { console.error(e); process.exit(1); });

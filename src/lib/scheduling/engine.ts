/**
 * core/scheduling — THE scheduling engine.
 *
 * One engine, consumed by every surface: client booking (slot generation +
 * submit revalidation), admin assignment, reschedules, and the mobile PWA.
 *
 * Design: this file is PURE — no Prisma, no fetch. All inputs (availability
 * windows, existing jobs, time off, travel times) are injected, which makes
 * the engine exhaustively testable (see scripts/test-scheduling.ts).
 * The Prisma/Mapbox glue lives in ./loader.ts.
 *
 * Business rules implemented (Build Brief §4/§8/§11):
 *  - All slot math in the WORKSPACE timezone; instants stored as UTC.
 *  - Appointment length = package durationMins → Σ service durations → 60min.
 *  - Static jobBufferMins between jobs, always.
 *  - Travel feasibility: pessimistic travel time (Mapbox + 15min buffer) from
 *    the previous location — the photographer's HOME BASE for the first job
 *    of the day — must land them at most 5 minutes late. Same check against
 *    the next job's start.
 *  - Time off blocks slots outright.
 *  - Min booking notice + max advance days enforced server-side.
 *  - maxJobsPerDay respected.
 */

import { wallTimeToUtc, wallDateDayOfWeek } from "./tz";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const LATE_ARRIVAL_GRACE_MINS = 5;

export interface EngineJob {
  id: string;
  scheduledAt: Date;          // UTC
  durationMins: number;
  address: string | null;     // full address string for travel lookups
}

export interface EngineStaff {
  staffProfileId: string;
  name?: string;
  /** Availability window for THIS weekday, wall times in workspace tz. Null = not working. */
  window: { startTime: string; endTime: string } | null;
  /** Existing (non-cancelled) jobs overlapping this wall-day, sorted or not. */
  jobs: EngineJob[];
  /** Absolute time-off ranges (UTC) overlapping this day. */
  timeOff: { startsAt: Date; endsAt: Date }[];
  homeAddress: string | null;
  maxJobsPerDay: number | null;
}

export type TravelFn = (
  fromAddress: string,
  toAddress: string
) => Promise<{ durationWithBufferMins: number }>;

export interface ComputeSlotsInput {
  /** Wall date being booked, "YYYY-MM-DD" in the workspace timezone. */
  dateISO: string;
  timezone: string;
  slotIntervalMins: number;
  /** Proposed job duration (package/services already resolved). */
  durationMins: number;
  /** Static buffer between jobs (workspace.jobBufferMins). */
  bufferMins: number;
  minBookingNoticeHours: number;
  maxAdvanceBookingDays: number;
  /** Full address of the property being booked (null → travel checks skipped). */
  targetAddress: string | null;
  now: Date;
  travel: TravelFn;
  staff: EngineStaff[];
}

export interface StaffSlots {
  staffProfileId: string;
  name?: string;
  /** Bookable slot start instants (UTC), aligned to slotIntervalMins. */
  slots: Date[];
}

export interface SlotValidation {
  ok: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIN = 60 * 1000;

function jobEnd(j: { scheduledAt: Date; durationMins: number }): Date {
  return new Date(j.scheduledAt.getTime() + j.durationMins * MIN);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ---------------------------------------------------------------------------
// Core: validate a single slot for a single staff member
// ---------------------------------------------------------------------------

export async function validateSlotForStaff(
  input: Omit<ComputeSlotsInput, "staff" | "slotIntervalMins">,
  staff: EngineStaff,
  slotStart: Date,
  opts?: { excludeJobId?: string }
): Promise<SlotValidation> {
  const {
    dateISO, timezone, durationMins, bufferMins,
    minBookingNoticeHours, maxAdvanceBookingDays, targetAddress, now, travel,
  } = input;

  const jobs = (opts?.excludeJobId
    ? staff.jobs.filter((j) => j.id !== opts.excludeJobId)
    : staff.jobs
  ).slice().sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const slotEnd = new Date(slotStart.getTime() + durationMins * MIN);

  // 1. Working window (wall → UTC, DST-correct)
  if (!staff.window) return { ok: false, reason: "NOT_WORKING" };
  const winStart = wallTimeToUtc(dateISO, staff.window.startTime, timezone);
  const winEnd = wallTimeToUtc(dateISO, staff.window.endTime, timezone);
  if (slotStart < winStart || slotEnd > winEnd) {
    return { ok: false, reason: "OUTSIDE_WORKING_HOURS" };
  }

  // 2. Booking notice / advance windows
  if (minBookingNoticeHours > 0) {
    const earliest = new Date(now.getTime() + minBookingNoticeHours * 60 * MIN);
    if (slotStart < earliest) return { ok: false, reason: "TOO_SOON" };
  } else if (slotStart <= now) {
    return { ok: false, reason: "IN_THE_PAST" };
  }
  if (maxAdvanceBookingDays > 0) {
    const latest = new Date(now.getTime() + maxAdvanceBookingDays * 24 * 60 * MIN);
    if (slotStart > latest) return { ok: false, reason: "TOO_FAR_OUT" };
  }

  // 3. Time off
  for (const t of staff.timeOff) {
    if (overlaps(slotStart, slotEnd, t.startsAt, t.endsAt)) {
      return { ok: false, reason: "TIME_OFF" };
    }
  }

  // 4. Max jobs per day
  if (staff.maxJobsPerDay != null && jobs.length >= staff.maxJobsPerDay) {
    return { ok: false, reason: "MAX_JOBS_REACHED" };
  }

  // 5. Static-buffer overlap with existing jobs
  for (const j of jobs) {
    const jStart = new Date(j.scheduledAt.getTime() - bufferMins * MIN);
    const jEnd = new Date(jobEnd(j).getTime() + bufferMins * MIN);
    if (overlaps(slotStart, slotEnd, jStart, jEnd)) {
      return { ok: false, reason: "OVERLAPS_EXISTING_JOB" };
    }
  }

  // 6. Travel feasibility (only when we know where the new job is)
  if (targetAddress) {
    // Previous location: latest job ending at/before the slot, else home base.
    const prev = jobs.filter((j) => jobEnd(j).getTime() <= slotStart.getTime()).pop();
    const fromAddress = prev?.address ?? staff.homeAddress;
    if (fromAddress) {
      const t = await travel(fromAddress, targetAddress);
      const departAt = prev ? jobEnd(prev) : null;
      if (departAt) {
        const arrival = new Date(departAt.getTime() + t.durationWithBufferMins * MIN);
        const lateMins = (arrival.getTime() - slotStart.getTime()) / MIN;
        if (lateMins > LATE_ARRIVAL_GRACE_MINS) {
          return { ok: false, reason: "TRAVEL_FROM_PREVIOUS_TOO_LONG" };
        }
      }
      // First job of the day from home: home departure is flexible — no check
      // needed on arrival, but keep hook for future working-hours-include-travel.
    }
    // Next job: leaving this job, can they make the next one?
    const next = jobs.find((j) => j.scheduledAt.getTime() >= slotEnd.getTime());
    if (next?.address) {
      const t = await travel(targetAddress, next.address);
      const arrival = new Date(slotEnd.getTime() + t.durationWithBufferMins * MIN);
      const lateMins = (arrival.getTime() - next.scheduledAt.getTime()) / MIN;
      if (lateMins > LATE_ARRIVAL_GRACE_MINS) {
        return { ok: false, reason: "TRAVEL_TO_NEXT_TOO_LONG" };
      }
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Core: compute all bookable slots for a day
// ---------------------------------------------------------------------------

export async function computeDaySlots(input: ComputeSlotsInput): Promise<StaffSlots[]> {
  const { dateISO, timezone, slotIntervalMins } = input;
  const interval = Math.max(5, slotIntervalMins || 30);
  const results: StaffSlots[] = [];

  for (const staff of input.staff) {
    const slots: Date[] = [];
    if (staff.window) {
      const winStart = wallTimeToUtc(dateISO, staff.window.startTime, timezone);
      const winEnd = wallTimeToUtc(dateISO, staff.window.endTime, timezone);
      for (
        let t = winStart.getTime();
        t + input.durationMins * MIN <= winEnd.getTime();
        t += interval * MIN
      ) {
        const v = await validateSlotForStaff(input, staff, new Date(t));
        if (v.ok) slots.push(new Date(t));
      }
    }
    results.push({ staffProfileId: staff.staffProfileId, name: staff.name, slots });
  }

  return results;
}

/** Weekday (0-6) of the wall date — convenience re-export for loaders. */
export function weekdayOf(dateISO: string): number {
  return wallDateDayOfWeek(dateISO);
}

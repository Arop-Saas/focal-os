/**
 * Conflict detection engine for the Focal OS scheduling system.
 *
 * A "conflict" means a photographer cannot physically travel from one job
 * to the next given the drive time + buffer between them.
 *
 * Rules (from product brief):
 * - Block any assignment where travel from the previous appointment would
 *   cause a photographer to arrive more than 5 minutes late.
 * - Use pessimistic travel estimates (duration + 15 min buffer).
 * - All times compared in UTC; display layer handles timezone conversion.
 */

import { getTravelTime, getTravelTimeBatch } from "./travel-time";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduledJob {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip?: string | null;
  scheduledAt: Date;
  estimatedDurationMins: number;
  status: string;
}

export interface ConflictCheckInput {
  /** The job being assigned/scheduled */
  proposedJob: {
    propertyAddress: string;
    propertyCity: string;
    propertyState: string;
    propertyZip?: string | null;
    scheduledAt: Date;
    estimatedDurationMins: number;
  };
  /** The photographer's existing jobs on the same day, sorted by scheduledAt */
  existingJobs: ScheduledJob[];
}

export interface ConflictDetail {
  type: "ARRIVAL_TOO_LATE" | "DEPARTURE_TOO_EARLY";
  conflictingJobId: string;
  conflictingJobNumber: string;
  /** How many minutes late the photographer would arrive */
  minutesLate: number;
  /** Drive time from/to the conflicting job */
  travelMins: number;
  travelWithBufferMins: number;
  distanceKm: number;
  message: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
  /** Pre-computed travel time from previous job to proposed job (if any) */
  travelFromPreviousMins?: number;
  /** Pre-computed travel time from proposed job to next job (if any) */
  travelToNextMins?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Full address string for Maps API */
function fullAddress(job: {
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip?: string | null;
}): string {
  const parts = [job.propertyAddress, job.propertyCity, job.propertyState];
  if (job.propertyZip) parts.push(job.propertyZip);
  return parts.join(", ");
}

/** Job end time = scheduledAt + estimatedDurationMins */
function jobEndTime(job: { scheduledAt: Date; estimatedDurationMins: number }): Date {
  return new Date(
    job.scheduledAt.getTime() + job.estimatedDurationMins * 60 * 1000
  );
}

/** 5-minute late arrival grace (as per brief) */
const LATE_ARRIVAL_GRACE_MINS = 5;

// ---------------------------------------------------------------------------
// Core conflict check
// ---------------------------------------------------------------------------

/**
 * Check whether assigning a photographer to `proposedJob` creates travel
 * conflicts with their `existingJobs` on the same day.
 *
 * Returns all conflicts found (there can be two: one with the preceding job
 * and one with the following job).
 */
export async function checkConflicts(
  input: ConflictCheckInput
): Promise<ConflictCheckResult> {
  const { proposedJob, existingJobs } = input;

  // Filter to jobs that are active (not cancelled/completed)
  const activeJobs = existingJobs.filter(
    (j) => !["CANCELLED", "COMPLETED"].includes(j.status)
  );

  if (activeJobs.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  const proposedStart = proposedJob.scheduledAt;
  const proposedEnd = jobEndTime(proposedJob);
  const proposedAddr = fullAddress(proposedJob);

  // Find the job immediately before and after the proposed slot
  const sortedJobs = [...activeJobs].sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
  );

  const prevJob = sortedJobs.filter(
    (j) => jobEndTime(j) <= proposedStart
  ).at(-1) ?? null;

  const nextJob =
    sortedJobs.find((j) => j.scheduledAt >= proposedEnd) ?? null;

  const conflicts: ConflictDetail[] = [];

  // Check conflict with PREVIOUS job
  // (can photographer get from prevJob to proposedJob in time?)
  let travelFromPreviousMins: number | undefined;

  if (prevJob) {
    const prevAddr = fullAddress(prevJob);
    const prevEnd = jobEndTime(prevJob);

    const travel = await getTravelTime(prevAddr, proposedAddr);
    travelFromPreviousMins = travel.durationWithBufferMins;

    // Available gap = proposedStart - prevEnd
    const gapMins =
      (proposedStart.getTime() - prevEnd.getTime()) / 60_000;

    if (travel.durationWithBufferMins > gapMins + LATE_ARRIVAL_GRACE_MINS) {
      const minutesLate = Math.ceil(
        travel.durationWithBufferMins - gapMins
      );
      conflicts.push({
        type: "ARRIVAL_TOO_LATE",
        conflictingJobId: prevJob.id,
        conflictingJobNumber: prevJob.jobNumber,
        minutesLate,
        travelMins: travel.durationMins,
        travelWithBufferMins: travel.durationWithBufferMins,
        distanceKm: travel.distanceKm,
        message: `Photographer would arrive ~${minutesLate} min late — not enough time after ${prevJob.jobNumber} (needs ${travel.durationWithBufferMins} min, only ${Math.floor(gapMins)} min available).`,
      });
    }
  }

  // Check conflict with NEXT job
  // (can photographer get from proposedJob to nextJob in time?)
  let travelToNextMins: number | undefined;

  if (nextJob) {
    const nextAddr = fullAddress(nextJob);
    const nextStart = nextJob.scheduledAt;

    const travel = await getTravelTime(proposedAddr, nextAddr);
    travelToNextMins = travel.durationWithBufferMins;

    const gapMins =
      (nextStart.getTime() - proposedEnd.getTime()) / 60_000;

    if (travel.durationWithBufferMins > gapMins + LATE_ARRIVAL_GRACE_MINS) {
      const minutesLate = Math.ceil(
        travel.durationWithBufferMins - gapMins
      );
      conflicts.push({
        type: "DEPARTURE_TOO_EARLY",
        conflictingJobId: nextJob.id,
        conflictingJobNumber: nextJob.jobNumber,
        minutesLate,
        travelMins: travel.durationMins,
        travelWithBufferMins: travel.durationWithBufferMins,
        distanceKm: travel.distanceKm,
        message: `Not enough time to reach ${nextJob.jobNumber} — would be ~${minutesLate} min late (needs ${travel.durationWithBufferMins} min, only ${Math.floor(gapMins)} min available).`,
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    travelFromPreviousMins,
    travelToNextMins,
  };
}

// ---------------------------------------------------------------------------
// Available staff check
// ---------------------------------------------------------------------------

export interface StaffAvailabilityEntry {
  staffId: string;
  staffName: string;
  existingJobs: ScheduledJob[];
  /** From StaffAvailability table */
  availableWindows: Array<{
    dayOfWeek: number; // 0=Sun
    startTime: string; // "09:00"
    endTime: string;   // "18:00"
    isAvailable: boolean;
  }>;
}

export interface StaffConflictResult {
  staffId: string;
  staffName: string;
  isAvailable: boolean;
  unavailableReason?: string;
  conflictResult: ConflictCheckResult;
}

/**
 * Check availability for multiple staff members at once.
 * Used by the "available photographers" query in the tRPC router.
 */
export async function checkStaffAvailability(
  proposedJob: ConflictCheckInput["proposedJob"],
  staffList: StaffAvailabilityEntry[]
): Promise<StaffConflictResult[]> {
  // Run all conflict checks in parallel
  const results = await Promise.all(
    staffList.map(async (staff): Promise<StaffConflictResult> => {
      // 1. Check availability windows (day-of-week based)
      const proposedDay = proposedJob.scheduledAt.getDay(); // 0=Sun
      const proposedStartMins = toMinuteOfDay(proposedJob.scheduledAt);
      const proposedEndMins =
        proposedStartMins + proposedJob.estimatedDurationMins;

      const window = staff.availableWindows.find(
        (w) => w.dayOfWeek === proposedDay && w.isAvailable
      );

      if (!window) {
        return {
          staffId: staff.staffId,
          staffName: staff.staffName,
          isAvailable: false,
          unavailableReason: "Not scheduled to work on this day",
          conflictResult: { hasConflict: false, conflicts: [] },
        };
      }

      const windowStart = timeStringToMins(window.startTime);
      const windowEnd = timeStringToMins(window.endTime);

      if (
        proposedStartMins < windowStart ||
        proposedEndMins > windowEnd
      ) {
        return {
          staffId: staff.staffId,
          staffName: staff.staffName,
          isAvailable: false,
          unavailableReason: `Outside availability window (${window.startTime}–${window.endTime})`,
          conflictResult: { hasConflict: false, conflicts: [] },
        };
      }

      // 2. Check travel conflicts
      const conflictResult = await checkConflicts({
        proposedJob,
        existingJobs: staff.existingJobs,
      });

      return {
        staffId: staff.staffId,
        staffName: staff.staffName,
        isAvailable: !conflictResult.hasConflict,
        unavailableReason: conflictResult.hasConflict
          ? conflictResult.conflicts[0].message
          : undefined,
        conflictResult,
      };
    })
  );

  return results;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Convert a Date to minutes since midnight (local time of the date) */
function toMinuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Convert "HH:MM" string to minutes since midnight */
function timeStringToMins(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/**
 * Compute travel times from each job in a photographer's day to the next,
 * and annotate the result with travelMins. Used to render travel gaps in the
 * dispatch calendar UI.
 */
export async function annotateDayWithTravelTimes(
  jobs: ScheduledJob[]
): Promise<
  Array<ScheduledJob & { travelToNextMins?: number; travelFromPreviousMins?: number }>
> {
  if (jobs.length === 0) return [];

  const sorted = [...jobs].sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
  );

  if (sorted.length === 1) return sorted;

  // Batch-fetch travel times between consecutive jobs
  const annotated = await Promise.all(
    sorted.map(async (job, i) => {
      let travelToNextMins: number | undefined;
      let travelFromPreviousMins: number | undefined;

      if (i < sorted.length - 1) {
        const next = sorted[i + 1];
        const travel = await getTravelTime(
          fullAddress(job),
          fullAddress(next)
        );
        travelToNextMins = travel.durationWithBufferMins;
      }

      if (i > 0) {
        const prev = sorted[i - 1];
        const travel = await getTravelTime(
          fullAddress(prev),
          fullAddress(job)
        );
        travelFromPreviousMins = travel.durationWithBufferMins;
      }

      return { ...job, travelToNextMins, travelFromPreviousMins };
    })
  );

  return annotated;
}

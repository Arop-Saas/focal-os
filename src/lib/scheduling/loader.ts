/**
 * core/scheduling loader — Prisma/Mapbox glue for the pure engine.
 *
 * Every surface (client booking, admin assignment, reschedule, mobile) MUST
 * go through these functions rather than re-implementing slot logic.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import {
  computeDaySlots,
  validateSlotForStaff,
  weekdayOf,
  type EngineStaff,
  type StaffSlots,
  type TravelFn,
} from "./engine";
import { wallDayUtcRange, utcToWallDateISO } from "./tz";
import { getTravelTime } from "./travel-time";

type Db = PrismaClient | Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/** Mirrors booking.submit's duration logic — one source of truth for callers. */
export async function resolveDurationMins(
  db: Db,
  args: { workspaceId: string; packageId?: string | null; serviceIds?: string[] | null }
): Promise<number> {
  if (args.packageId) {
    const pkg = await db.package.findFirst({
      where: { id: args.packageId, workspaceId: args.workspaceId },
      include: { items: { include: { service: { select: { durationMins: true } } } } },
    });
    if (pkg?.durationMins && pkg.durationMins > 0) return pkg.durationMins;
    const total = (pkg?.items ?? []).reduce(
      (sum, i) => sum + i.service.durationMins * i.quantity, 0
    );
    if (total > 0) return total;
  } else if (args.serviceIds?.length) {
    const services = await db.service.findMany({
      where: { id: { in: args.serviceIds }, workspaceId: args.workspaceId },
      select: { durationMins: true },
    });
    const total = services.reduce((s, x) => s + x.durationMins, 0);
    if (total > 0) return total;
  }
  return 60;
}

const defaultTravel: TravelFn = async (from, to) => {
  const t = await getTravelTime(from, to);
  return { durationWithBufferMins: t.durationWithBufferMins };
};

interface LoadStaffArgs {
  workspaceId: string;
  dateISO: string;
  timezone: string;
  territoryId?: string | null;
  staffProfileId?: string | null;
}

/** Load active staff (optionally one, optionally territory-filtered) with the
 *  weekday window, same-day jobs (incl. cross-midnight overlap), and time off. */
export async function loadEngineStaff(db: Db, args: LoadStaffArgs): Promise<EngineStaff[]> {
  const dayOfWeek = weekdayOf(args.dateISO);
  const { start, end } = wallDayUtcRange(args.dateISO, args.timezone);
  // catch cross-midnight jobs that started up to 12h before the day
  const jobWindowStart = new Date(start.getTime() - 12 * 3600e3);

  const profiles = await db.staffProfile.findMany({
    where: {
      workspaceId: args.workspaceId,
      isActive: true,
      ...(args.staffProfileId ? { id: args.staffProfileId } : {}),
    },
    include: {
      member: { include: { user: { select: { fullName: true, email: true, avatarUrl: true } } } },
      availability: { where: { dayOfWeek } },
      timeOffEntries: {
        where: { startsAt: { lt: end }, endsAt: { gt: start } },
        select: { startsAt: true, endsAt: true },
      },
      jobAssignments: {
        where: {
          job: {
            scheduledAt: { gte: jobWindowStart, lte: end },
            status: { notIn: ["CANCELLED"] },
          },
        },
        include: {
          job: {
            select: {
              id: true, scheduledAt: true, estimatedDurationMins: true,
              propertyAddress: true, propertyCity: true, propertyState: true, propertyZip: true,
            },
          },
        },
      },
    },
  });

  return profiles
    .filter((p) => {
      // Territory filter: matches getAvailablePhotographers semantics —
      // staff with a homeTerritory only serve it; staff without serve anywhere.
      if (args.territoryId && p.homeTerritoryId && p.homeTerritoryId !== args.territoryId) {
        return false;
      }
      return true;
    })
    .map((p) => {
      const win = p.availability.find((a) => a.isAvailable);
      const jobs = p.jobAssignments
        .map((a) => a.job)
        .filter((j) => {
          const jEnd = new Date(j.scheduledAt.getTime() + j.estimatedDurationMins * 60e3);
          return jEnd > start && j.scheduledAt < end; // overlaps the wall day
        })
        .map((j) => ({
          id: j.id,
          scheduledAt: j.scheduledAt,
          durationMins: j.estimatedDurationMins,
          address: [j.propertyAddress, j.propertyCity, j.propertyState, j.propertyZip]
            .filter(Boolean).join(", "),
        }));
      return {
        staffProfileId: p.id,
        name: p.member?.user?.fullName ?? p.member?.user?.email ?? undefined,
        avatarUrl: p.member?.user?.avatarUrl ?? null,
        window: win ? { startTime: win.startTime, endTime: win.endTime } : null,
        jobs,
        timeOff: p.timeOffEntries,
        homeAddress: p.homeAddress ?? null,
        maxJobsPerDay: p.maxJobsPerDay ?? null,
      } satisfies EngineStaff;
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DayAvailabilityArgs {
  workspaceId: string;
  dateISO: string;              // wall date in the WORKSPACE timezone
  packageId?: string | null;
  serviceIds?: string[] | null;
  formId?: string | null;
  territoryId?: string | null;
  staffProfileId?: string | null;
  targetAddress?: string | null;
  travel?: TravelFn;            // injectable for tests
  now?: Date;
}

export interface DayAvailabilityResult {
  timezone: string;
  durationMins: number;
  slotIntervalMins: number;
  staffSlots: StaffSlots[];
}

export async function getDayAvailability(
  db: Db,
  args: DayAvailabilityArgs
): Promise<DayAvailabilityResult> {
  const workspace = await db.workspace.findUnique({
    where: { id: args.workspaceId },
    select: { id: true, timezone: true, jobBufferMins: true },
  });
  if (!workspace) throw new Error("Workspace not found");

  const form = args.formId
    ? await db.orderForm.findFirst({
        where: { id: args.formId, workspaceId: workspace.id },
        select: { timeSlotInterval: true, minBookingNoticeHours: true, maxAdvanceBookingDays: true },
      })
    : null;

  const durationMins = await resolveDurationMins(db, {
    workspaceId: workspace.id,
    packageId: args.packageId,
    serviceIds: args.serviceIds,
  });

  let staff = await loadEngineStaff(db, {
    workspaceId: workspace.id,
    dateISO: args.dateISO,
    timezone: workspace.timezone,
    territoryId: args.territoryId,
    staffProfileId: args.staffProfileId,
  });

  // Workspaces with no staff profiles (solo setups) get a "virtual" staff
  // member built from workspace business hours, blocked by ALL of the
  // workspace's jobs that day — preserving pre-engine booking behavior.
  if (staff.length === 0 && !args.staffProfileId) {
    staff = [await buildVirtualStaff(db, workspace.id, args.dateISO, workspace.timezone)];
  }

  const staffSlots = await computeDaySlots({
    dateISO: args.dateISO,
    timezone: workspace.timezone,
    slotIntervalMins: form?.timeSlotInterval ?? 30,
    durationMins,
    bufferMins: workspace.jobBufferMins,
    minBookingNoticeHours: form?.minBookingNoticeHours ?? 0,
    maxAdvanceBookingDays: form?.maxAdvanceBookingDays ?? 0,
    targetAddress: args.targetAddress ?? null,
    now: args.now ?? new Date(),
    travel: args.travel ?? defaultTravel,
    staff,
  });

  return {
    timezone: workspace.timezone,
    durationMins,
    slotIntervalMins: form?.timeSlotInterval ?? 30,
    staffSlots,
  };
}

async function buildVirtualStaff(
  db: Db,
  workspaceId: string,
  dateISO: string,
  timezone: string
): Promise<EngineStaff> {
  const dayOfWeek = weekdayOf(dateISO);
  const hours = await db.workspaceHours.findFirst({
    where: { workspaceId, dayOfWeek },
    select: { isOpen: true, openTime: true, closeTime: true },
  });
  const { start, end } = wallDayUtcRange(dateISO, timezone);
  const jobs = await db.job.findMany({
    where: {
      workspaceId,
      scheduledAt: { gte: new Date(start.getTime() - 12 * 3600e3), lte: end },
      status: { notIn: ["CANCELLED"] },
    },
    select: {
      id: true, scheduledAt: true, estimatedDurationMins: true,
      propertyAddress: true, propertyCity: true, propertyState: true, propertyZip: true,
    },
  });
  const window = hours
    ? hours.isOpen
      ? { startTime: hours.openTime, endTime: hours.closeTime }
      : null
    : { startTime: "09:00", endTime: "17:00" };
  return {
    staffProfileId: "",
    window,
    jobs: jobs
      .filter((j) => {
        const jEnd = new Date(j.scheduledAt.getTime() + j.estimatedDurationMins * 60e3);
        return jEnd > start && j.scheduledAt < end;
      })
      .map((j) => ({
        id: j.id,
        scheduledAt: j.scheduledAt,
        durationMins: j.estimatedDurationMins,
        address: [j.propertyAddress, j.propertyCity, j.propertyState, j.propertyZip]
          .filter(Boolean).join(", "),
      })),
    timeOff: [],
    homeAddress: null,
    maxJobsPerDay: null,
  };
}

export class SlotUnavailableError extends Error {
  constructor(public reason: string, message?: string) {
    super(message ?? `Slot unavailable: ${reason}`);
    this.name = "SlotUnavailableError";
  }
}

export interface AssertSlotArgs {
  workspaceId: string;
  scheduledAt: Date;
  /** Use this exact duration (e.g. an existing job) instead of resolving from package/services. */
  durationMins?: number | null;
  staffProfileId?: string | null;
  packageId?: string | null;
  serviceIds?: string[] | null;
  formId?: string | null;
  territoryId?: string | null;
  targetAddress?: string | null;
  excludeJobId?: string | null;
  travel?: TravelFn;
  now?: Date;
}

/**
 * Server-side slot revalidation — call INSIDE the booking/assignment
 * transaction (after taking the advisory lock, see takeStaffLock) so a
 * concurrent submit cannot double-book.
 *
 * - With staffProfileId: that photographer must be able to take the slot.
 * - Without: at least one active photographer must be able to (no assignment
 *   is created — matches current unassigned-booking behavior).
 * - Workspaces with NO active staff profiles skip validation entirely
 *   (solo setups that never configured staff keep working).
 */
export async function assertSlotBookable(db: Db, args: AssertSlotArgs): Promise<void> {
  const workspace = await db.workspace.findUnique({
    where: { id: args.workspaceId },
    select: { id: true, timezone: true, jobBufferMins: true },
  });
  if (!workspace) throw new SlotUnavailableError("WORKSPACE_NOT_FOUND");

  const staffCount = await db.staffProfile.count({
    where: { workspaceId: workspace.id, isActive: true },
  });
  if (staffCount === 0) return; // legacy solo workspaces — nothing to validate against

  const dateISO = utcToWallDateISO(args.scheduledAt, workspace.timezone);
  const form = args.formId
    ? await db.orderForm.findFirst({
        where: { id: args.formId, workspaceId: workspace.id },
        select: { minBookingNoticeHours: true, maxAdvanceBookingDays: true },
      })
    : null;

  const durationMins = args.durationMins ?? await resolveDurationMins(db, {
    workspaceId: workspace.id,
    packageId: args.packageId,
    serviceIds: args.serviceIds,
  });

  const staff = await loadEngineStaff(db, {
    workspaceId: workspace.id,
    dateISO,
    timezone: workspace.timezone,
    territoryId: args.territoryId,
    staffProfileId: args.staffProfileId,
  });

  if (args.staffProfileId && staff.length === 0) {
    throw new SlotUnavailableError("STAFF_NOT_FOUND", "That photographer is not available.");
  }

  const base = {
    dateISO,
    timezone: workspace.timezone,
    durationMins,
    bufferMins: workspace.jobBufferMins,
    minBookingNoticeHours: form?.minBookingNoticeHours ?? 0,
    maxAdvanceBookingDays: form?.maxAdvanceBookingDays ?? 0,
    targetAddress: args.targetAddress ?? null,
    now: args.now ?? new Date(),
    travel: args.travel ?? defaultTravel,
  };

  let lastReason = "NO_STAFF_AVAILABLE";
  for (const s of staff) {
    const v = await validateSlotForStaff(base, s, args.scheduledAt, {
      excludeJobId: args.excludeJobId ?? undefined,
    });
    if (v.ok) return;
    lastReason = v.reason ?? lastReason;
  }
  throw new SlotUnavailableError(lastReason, humanReason(lastReason));
}

/** Serialize competing bookings for the same photographer (or workspace-day). */
export async function takeSchedulingLock(
  tx: Prisma.TransactionClient,
  key: string
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

function humanReason(reason: string): string {
  switch (reason) {
    case "OVERLAPS_EXISTING_JOB":
    case "MAX_JOBS_REACHED":
      return "That time was just booked — please pick another slot.";
    case "TRAVEL_FROM_PREVIOUS_TOO_LONG":
    case "TRAVEL_TO_NEXT_TOO_LONG":
      return "The photographer can't reach this property in time around an existing appointment — please pick another slot.";
    case "TIME_OFF":
    case "NOT_WORKING":
    case "OUTSIDE_WORKING_HOURS":
      return "The photographer isn't available at that time — please pick another slot.";
    case "TOO_SOON":
      return "That time is inside the minimum booking notice — please pick a later slot.";
    case "TOO_FAR_OUT":
      return "That date is beyond the booking window — please pick an earlier date.";
    case "IN_THE_PAST":
      return "That time is in the past.";
    default:
      return "That time is no longer available — please pick another slot.";
  }
}

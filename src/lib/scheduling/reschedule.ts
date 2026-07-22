/**
 * core/scheduling — ONE reschedule path for every surface (S8).
 *
 * Admin (jobs.update) and the client portal both funnel here so the engine
 * check, the client email, the owner bell, the activity log, and the Google
 * Calendar event move together — no surface can drift.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { assertSlotBookable, SlotUnavailableError } from "@/lib/scheduling/loader";
import { notifyJobRescheduled } from "@/lib/notify";
import { updateCalendarEvent } from "@/lib/gcal";

type Db = PrismaClient | Prisma.TransactionClient;

export { SlotUnavailableError };

export class RescheduleNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RescheduleNotAllowedError";
  }
}

export interface RescheduleArgs {
  workspaceId: string;
  jobId: string;
  newTime: Date;
  /** Who initiated it — goes to the activity log verbatim. */
  actor: { userId: string | null; label: "admin" | "client-portal" };
  /** User whose bell gets the in-app notification (workspace owner for portal). */
  notifyUserId?: string;
  /** Statuses allowed to move. Portal is stricter than admin. */
  allowedStatuses?: string[];
}

export async function rescheduleJob(db: Db, args: RescheduleArgs) {
  const job = await db.job.findFirst({
    where: { id: args.jobId, workspaceId: args.workspaceId },
    include: { client: true },
  });
  if (!job) throw new RescheduleNotAllowedError("Job not found.");

  if (args.allowedStatuses && !args.allowedStatuses.includes(job.status)) {
    throw new RescheduleNotAllowedError(
      `A job in status ${job.status.toLowerCase().replace(/_/g, " ")} can no longer be rescheduled.`
    );
  }
  if (args.newTime.getTime() <= Date.now()) {
    throw new RescheduleNotAllowedError("The new time must be in the future.");
  }
  if (job.scheduledAt && args.newTime.getTime() === job.scheduledAt.getTime()) {
    return { job, changed: false as const };
  }

  // ── Engine enforcement: the new slot must work for EVERY assigned photographer
  const assignments = await db.jobAssignment.findMany({
    where: { jobId: job.id },
    select: { staffId: true },
  });
  for (const a of assignments) {
    await assertSlotBookable(db, {
      workspaceId: args.workspaceId,
      scheduledAt: args.newTime,
      durationMins: job.estimatedDurationMins,
      staffProfileId: a.staffId,
      targetAddress: [job.propertyAddress, job.propertyCity, job.propertyState, job.propertyZip]
        .filter(Boolean)
        .join(", "),
      excludeJobId: job.id,
    });
  }

  const oldTime = job.scheduledAt;
  const updated = await db.job.update({
    where: { id: job.id },
    data: { scheduledAt: args.newTime },
  });

  await db.activityLog.create({
    data: {
      workspaceId: args.workspaceId,
      userId: args.actor.userId,
      action: "job.rescheduled",
      entityType: "job",
      entityId: job.id,
      metadata: {
        by: args.actor.label,
        from: oldTime?.toISOString() ?? null,
        to: args.newTime.toISOString(),
      },
    },
  });

  // ── Side effects — AWAITED so they survive the serverless response freeze.
  // On Vercel, work left running after the handler returns is killed, so a
  // `void`ed email silently never sends. Neither call can fail the reschedule:
  // notifyJobRescheduled swallows internally (Promise.allSettled) and
  // syncCalendarEvents is wrapped in try/catch.
  if (oldTime && job.client?.email) {
    await notifyJobRescheduled({
      workspaceId: args.workspaceId,
      jobId: job.id,
      userId: args.notifyUserId,
      clientEmail: job.client.email,
      clientName: `${job.client.firstName} ${job.client.lastName}`,
      jobNumber: job.jobNumber,
      propertyAddress: job.propertyAddress,
      oldTime,
      newTime: args.newTime,
    });
  }

  await syncCalendarEvents(db, job.id, args.newTime, updated.estimatedDurationMins, updated.propertyAddress);

  return { job: updated, changed: true as const };
}

async function syncCalendarEvents(
  db: Db,
  jobId: string,
  startAt: Date,
  durationMins: number | null,
  propertyAddress: string
) {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – gcalEventId added via migration; regenerate client to drop this
    const assignments = await db.jobAssignment.findMany({
      // @ts-ignore
      where: { jobId, gcalEventId: { not: null } },
      include: {
        staff: {
          include: {
            member: {
              include: {
                user: { select: { googleRefreshToken: true, googleCalendarId: true } },
              },
            },
          },
        },
      },
    });

    const updates: Promise<unknown>[] = [];
    for (const assignment of assignments) {
      const refreshToken = (assignment as any).staff.member.user.googleRefreshToken;
      const calendarId = (assignment as any).staff.member.user.googleCalendarId ?? "primary";
      const gcalEventId = (assignment as any).gcalEventId;
      if (refreshToken && gcalEventId) {
        const endAt = new Date(startAt.getTime() + (durationMins ?? 90) * 60_000);
        updates.push(
          updateCalendarEvent(refreshToken, gcalEventId, {
            title: `📷 Shoot — ${propertyAddress}`,
            startAt,
            endAt,
            calendarId,
          }).catch((e) => {
            console.error("[reschedule] gcal event update failed:", e);
          })
        );
      }
    }
    // Await the actual API calls — otherwise they're orphaned and die with the
    // serverless invocation. allSettled so one bad token can't reject the batch.
    await Promise.allSettled(updates);
  } catch (err) {
    console.error("[reschedule] gcal sync failed:", err);
  }
}

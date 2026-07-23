import type { Prisma, PrismaClient, AppointmentStatus, JobStatus } from "@prisma/client";

/**
 * Appointment ↔ Job.scheduledAt sync (strangler pattern).
 *
 * INVARIANT: Job.scheduledAt always equals the primary Appointment's
 * scheduledAt. Legacy code (scheduling engine, dashboard, calendar, portal)
 * reads Job.scheduledAt; new order-centric code reads Appointments. Every
 * code path that writes Job.scheduledAt MUST also call
 * syncPrimaryAppointment in the same transaction — never write one alone.
 *
 * Non-primary appointments (twilight shoot, Matterport visit, …) exist only
 * in the Appointment table and are invisible to legacy readers by design.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Sensible primary-appointment status for a job whose lifecycle status changed. */
export function appointmentStatusForJobStatus(status: JobStatus): AppointmentStatus {
  switch (status) {
    case "CANCELLED":
      return "CANCELLED";
    case "IN_PROGRESS":
      return "ARRIVED";
    case "EDITING":
    case "REVIEW":
    case "DELIVERED":
    case "COMPLETED":
      return "CAPTURED";
    default:
      return "SCHEDULED";
  }
}

export async function syncPrimaryAppointment(
  db: Db,
  args: {
    workspaceId: string;
    jobId: string;
    scheduledAt: Date | null;
    durationMins?: number;
    status?: AppointmentStatus;
  }
): Promise<void> {
  const existing = await db.appointment.findFirst({
    where: { jobId: args.jobId, isPrimary: true },
    select: { id: true },
  });

  if (existing) {
    await db.appointment.update({
      where: { id: existing.id },
      data: {
        scheduledAt: args.scheduledAt,
        ...(args.durationMins !== undefined && { durationMins: args.durationMins }),
        ...(args.status !== undefined && { status: args.status }),
      },
    });
  } else {
    await db.appointment.create({
      data: {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        scheduledAt: args.scheduledAt,
        durationMins: args.durationMins ?? 90,
        status: args.status ?? "SCHEDULED",
        isPrimary: true,
      },
    });
  }
}

/** Mark every appointment of a job cancelled (job-level cancellation). */
export async function cancelAppointmentsForJob(db: Db, jobId: string): Promise<void> {
  await db.appointment.updateMany({
    where: { jobId, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED" },
  });
}

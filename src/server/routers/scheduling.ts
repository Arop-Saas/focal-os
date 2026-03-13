import { z } from "zod";
import { router, workspaceProcedure } from "../trpc";
import {
  checkConflicts,
  checkStaffAvailability,
  annotateDayWithTravelTimes,
  type ScheduledJob,
} from "@/lib/scheduling/conflicts";

export const schedulingRouter = router({
  /**
   * Check whether assigning a specific photographer to a job creates
   * travel conflicts. Called in real-time as dispatcher selects a staff member.
   */
  checkConflicts: workspaceProcedure
    .input(
      z.object({
        staffId: z.string(),
        proposedJob: z.object({
          propertyAddress: z.string(),
          propertyCity: z.string(),
          propertyState: z.string(),
          propertyZip: z.string().optional(),
          scheduledAt: z.date(),
          estimatedDurationMins: z.number(),
        }),
        /** Optionally exclude a jobId when re-scheduling an existing job */
        excludeJobId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { staffId, proposedJob, excludeJobId } = input;

      // Fetch this photographer's jobs on the same day
      const dayStart = new Date(proposedJob.scheduledAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(proposedJob.scheduledAt);
      dayEnd.setHours(23, 59, 59, 999);

      const existingAssignments = await ctx.prisma.jobAssignment.findMany({
        where: {
          staffId,
          job: {
            workspaceId: ctx.workspace.id,
            scheduledAt: { gte: dayStart, lte: dayEnd },
            status: { notIn: ["CANCELLED", "COMPLETED"] },
            ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
          },
        },
        include: {
          job: {
            select: {
              id: true,
              jobNumber: true,
              propertyAddress: true,
              propertyCity: true,
              propertyState: true,
              propertyZip: true,
              scheduledAt: true,
              estimatedDurationMins: true,
              status: true,
            },
          },
        },
      });

      const existingJobs: ScheduledJob[] = existingAssignments.map(
        (a) => a.job
      );

      return checkConflicts({ proposedJob, existingJobs });
    }),

  /**
   * Get all available photographers for a given job slot.
   * Returns each staff member with their conflict status.
   */
  getAvailableStaff: workspaceProcedure
    .input(
      z.object({
        propertyAddress: z.string(),
        propertyCity: z.string(),
        propertyState: z.string(),
        propertyZip: z.string().optional(),
        scheduledAt: z.date(),
        estimatedDurationMins: z.number().default(90),
        excludeJobId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { excludeJobId, ...proposedJob } = input;

      const dayStart = new Date(proposedJob.scheduledAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(proposedJob.scheduledAt);
      dayEnd.setHours(23, 59, 59, 999);
      const dayOfWeek = proposedJob.scheduledAt.getDay();

      // Fetch all active staff with their availability and day's jobs
      const staffProfiles = await ctx.prisma.staffProfile.findMany({
        where: { workspaceId: ctx.workspace.id, isActive: true },
        include: {
          member: { include: { user: { select: { fullName: true } } } },
          availability: {
            where: { dayOfWeek, isAvailable: true },
          },
          jobAssignments: {
            where: {
              job: {
                workspaceId: ctx.workspace.id,
                scheduledAt: { gte: dayStart, lte: dayEnd },
                status: { notIn: ["CANCELLED", "COMPLETED"] },
                ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
              },
            },
            include: {
              job: {
                select: {
                  id: true,
                  jobNumber: true,
                  propertyAddress: true,
                  propertyCity: true,
                  propertyState: true,
                  propertyZip: true,
                  scheduledAt: true,
                  estimatedDurationMins: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      const staffList = staffProfiles.map((s) => ({
        staffId: s.id,
        staffName: s.member.user.fullName,
        existingJobs: s.jobAssignments.map((a) => a.job) as ScheduledJob[],
        availableWindows: s.availability.map((a) => ({
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
          isAvailable: a.isAvailable,
        })),
      }));

      const results = await checkStaffAvailability(proposedJob, staffList);

      // Sort: available first, then by name
      return results.sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) {
          return a.isAvailable ? -1 : 1;
        }
        return a.staffName.localeCompare(b.staffName);
      });
    }),

  /**
   * Get the full day schedule for all photographers, annotated with
   * travel times between consecutive jobs. Powers the dispatch calendar.
   */
  getDaySchedule: workspaceProcedure
    .input(
      z.object({
        date: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const dayStart = new Date(input.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(input.date);
      dayEnd.setHours(23, 59, 59, 999);

      // Get all jobs for this day with their primary assignments
      const jobs = await ctx.prisma.job.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          scheduledAt: { gte: dayStart, lte: dayEnd },
          status: { notIn: ["CANCELLED"] },
        },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          package: { select: { id: true, name: true } },
          assignments: {
            include: {
              staff: {
                include: {
                  member: {
                    include: {
                      user: { select: { id: true, fullName: true, avatarUrl: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { scheduledAt: "asc" },
      });

      // Group jobs by photographer
      const byPhotographer = new Map<
        string,
        {
          staffId: string;
          staffName: string;
          avatarUrl: string | null;
          jobs: typeof jobs;
        }
      >();

      // Add unassigned bucket
      const unassigned: typeof jobs = [];

      for (const job of jobs) {
        const primaryAssignment = job.assignments.find((a) => a.isPrimary);
        if (!primaryAssignment) {
          unassigned.push(job);
          continue;
        }

        const staffId = primaryAssignment.staff.id;
        const staffName = primaryAssignment.staff.member.user.fullName;
        const avatarUrl = primaryAssignment.staff.member.user.avatarUrl;

        if (!byPhotographer.has(staffId)) {
          byPhotographer.set(staffId, {
            staffId,
            staffName,
            avatarUrl,
            jobs: [],
          });
        }
        byPhotographer.get(staffId)!.jobs.push(job);
      }

      // Annotate each photographer's jobs with travel times
      const photographerSchedules = await Promise.all(
        Array.from(byPhotographer.values()).map(async (photographer) => {
          const annotated = await annotateDayWithTravelTimes(
            photographer.jobs.map((j) => ({
              id: j.id,
              jobNumber: j.jobNumber,
              propertyAddress: j.propertyAddress,
              propertyCity: j.propertyCity,
              propertyState: j.propertyState,
              propertyZip: j.propertyZip,
              scheduledAt: j.scheduledAt,
              estimatedDurationMins: j.estimatedDurationMins,
              status: j.status,
            }))
          );

          // Merge annotated travel data back into full job objects
          const jobsWithTravel = photographer.jobs.map((job, i) => ({
            ...job,
            travelToNextMins: annotated[i].travelToNextMins,
            travelFromPreviousMins: annotated[i].travelFromPreviousMins,
            hasConflict:
              annotated[i].travelToNextMins !== undefined &&
              annotated[i].travelToNextMins > 0
                ? checkTravelConflict(
                    job,
                    photographer.jobs[i + 1],
                    annotated[i].travelToNextMins!
                  )
                : false,
          }));

          return {
            staffId: photographer.staffId,
            staffName: photographer.staffName,
            avatarUrl: photographer.avatarUrl,
            jobs: jobsWithTravel,
          };
        })
      );

      return {
        date: input.date,
        photographers: photographerSchedules.sort((a, b) =>
          a.staffName.localeCompare(b.staffName)
        ),
        unassigned,
      };
    }),
});

// ---------------------------------------------------------------------------
// Helper: check if a travel time creates a conflict between two consecutive jobs
// ---------------------------------------------------------------------------
function checkTravelConflict(
  fromJob: { scheduledAt: Date; estimatedDurationMins: number },
  toJob: { scheduledAt: Date } | undefined,
  travelMins: number
): boolean {
  if (!toJob) return false;
  const fromEnd =
    fromJob.scheduledAt.getTime() + fromJob.estimatedDurationMins * 60_000;
  const toStart = toJob.scheduledAt.getTime();
  const gapMins = (toStart - fromEnd) / 60_000;
  return travelMins > gapMins + 5; // 5-min grace
}

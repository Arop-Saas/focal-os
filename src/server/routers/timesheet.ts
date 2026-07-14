/**
 * S6 — timesheet router: time + mileage records (Build Brief W3/W7).
 * AUTO entries come from mobile clock-out; MANUAL entries from the
 * mileage report page. One row per job+staff (manual overrides auto).
 */
import { z } from "zod";
import { router, workspaceProcedure } from "../trpc";

export const timesheetRouter = router({
  listMileage: workspaceProcedure
    .input(z.object({ dateFrom: z.date(), dateTo: z.date() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.mileageEntry.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          date: { gte: input.dateFrom, lte: input.dateTo },
        },
        orderBy: { date: "asc" },
      });
    }),

  listTimeEntries: workspaceProcedure
    .input(z.object({ dateFrom: z.date(), dateTo: z.date() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.timeEntry.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          startedAt: { gte: input.dateFrom, lte: input.dateTo },
        },
        orderBy: { startedAt: "asc" },
      });
    }),

  /** Upsert a MANUAL mileage figure for a job (report-page editing). */
  setJobMileage: workspaceProcedure
    .input(z.object({
      jobId: z.string(),
      staffId: z.string().optional(),
      distanceKm: z.number().min(0).max(2000),
      date: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        select: { id: true, assignments: { select: { staffId: true }, take: 1 } },
      });
      if (!job) throw new Error("Job not found");
      const staffId = input.staffId ?? job.assignments[0]?.staffId;
      if (!staffId) throw new Error("Job has no assigned staff");

      const existing = await ctx.prisma.mileageEntry.findFirst({
        where: { jobId: input.jobId, source: "MANUAL" },
      });
      if (input.distanceKm === 0) {
        if (existing) await ctx.prisma.mileageEntry.delete({ where: { id: existing.id } });
        return { ok: true };
      }
      if (existing) {
        await ctx.prisma.mileageEntry.update({
          where: { id: existing.id },
          data: { distanceKm: input.distanceKm, date: input.date },
        });
      } else {
        await ctx.prisma.mileageEntry.create({
          data: {
            workspaceId: ctx.workspace.id,
            staffId,
            jobId: input.jobId,
            date: input.date,
            distanceKm: input.distanceKm,
            source: "MANUAL",
          },
        });
      }
      return { ok: true };
    }),
});

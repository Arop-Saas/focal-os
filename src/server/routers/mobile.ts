import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { startOfDay, endOfDay, addDays } from "date-fns";

// ─── Mobile procedure — requires logged-in user with a StaffProfile ──────────

const mobileProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const staffProfile = await ctx.prisma.staffProfile.findFirst({
    where: {
      member: { userId: ctx.user.id },
      isActive: true,
    },
    include: {
      member: { include: { workspace: true } },
    },
  });

  if (!staffProfile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active staff profile found for this account.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      staffProfile,
      workspace: staffProfile.member.workspace,
    },
  });
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const mobileRouter = router({

  // Get my assigned jobs — today + next 7 days
  getMyJobs: mobileProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const rangeStart = startOfDay(now);
    const rangeEnd = endOfDay(addDays(now, 7));

    const assignments = await ctx.prisma.jobAssignment.findMany({
      where: {
        staffId: ctx.staffProfile.id,
        job: {
          workspaceId: ctx.workspace.id,
          scheduledAt: { gte: rangeStart, lte: rangeEnd },
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
      },
      include: {
        job: {
          include: {
            client: {
              select: { id: true, firstName: true, lastName: true, phone: true, email: true },
            },
            package: { select: { id: true, name: true } },
            services: {
              include: { service: { select: { id: true, name: true } } },
            },
            gallery: { select: { id: true, mediaCount: true, slug: true } },
            assignments: {
              include: {
                staff: {
                  include: {
                    member: {
                      include: {
                        user: { select: { fullName: true, avatarUrl: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { job: { scheduledAt: "asc" } },
    });

    return assignments.map((a) => a.job);
  }),

  // Get single job detail
  getJob: mobileProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify this photographer is assigned to the job
      const assignment = await ctx.prisma.jobAssignment.findFirst({
        where: { jobId: input.jobId, staffId: ctx.staffProfile.id },
      });
      if (!assignment) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not assigned to this job." });
      }

      const job = await ctx.prisma.job.findUnique({
        where: { id: input.jobId },
        include: {
          client: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          package: { select: { id: true, name: true } },
          services: {
            include: { service: { select: { id: true, name: true } } },
          },
          gallery: { select: { id: true, mediaCount: true, slug: true } },
          checklist: { orderBy: { sortOrder: "asc" } },
          assignments: {
            include: {
              staff: {
                include: {
                  member: {
                    include: {
                      user: { select: { fullName: true, avatarUrl: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return job;
    }),

  // Clock in — sets actualStartAt + moves job to IN_PROGRESS
  clockIn: mobileProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.jobAssignment.findFirst({
        where: { jobId: input.jobId, staffId: ctx.staffProfile.id },
      });
      if (!assignment) throw new TRPCError({ code: "FORBIDDEN" });

      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (job.actualStartAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Already clocked in." });

      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: {
          actualStartAt: new Date(),
          status: "IN_PROGRESS",
        },
        select: { id: true, actualStartAt: true, status: true },
      });
    }),

  // Clock out — sets actualEndAt
  clockOut: mobileProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.jobAssignment.findFirst({
        where: { jobId: input.jobId, staffId: ctx.staffProfile.id },
      });
      if (!assignment) throw new TRPCError({ code: "FORBIDDEN" });

      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (!job.actualStartAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Not clocked in yet." });

      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { actualEndAt: new Date() },
        select: { id: true, actualStartAt: true, actualEndAt: true },
      });
    }),

  // Mark job complete
  completeJob: mobileProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.jobAssignment.findFirst({
        where: { jobId: input.jobId, staffId: ctx.staffProfile.id },
      });
      if (!assignment) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: {
          status: "EDITING",
          actualEndAt: (await ctx.prisma.job.findUnique({ where: { id: input.jobId }, select: { actualEndAt: true } }))?.actualEndAt ?? new Date(),
        },
        select: { id: true, status: true },
      });
    }),

  // Add/update field note
  saveNote: mobileProcedure
    .input(z.object({ jobId: z.string(), note: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.jobAssignment.findFirst({
        where: { jobId: input.jobId, staffId: ctx.staffProfile.id },
      });
      if (!assignment) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { internalNotes: input.note },
        select: { id: true, internalNotes: true },
      });
    }),

  // Get my profile
  getProfile: mobileProcedure.query(async ({ ctx }) => {
    return {
      fullName: ctx.user.fullName,
      email: ctx.user.email,
      avatarUrl: ctx.user.avatarUrl,
      title: ctx.staffProfile.title,
      workspaceName: ctx.workspace.name,
      workspaceLogo: ctx.workspace.logoUrl,
    };
  }),
});

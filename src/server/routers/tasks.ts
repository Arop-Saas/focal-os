import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

/**
 * Team tasks (Collaboration → Tasks): checkbox to-dos for the whole team,
 * optionally attached to an order. Distinct from ProductionTask, which is
 * the per-order production pipeline (see docs/orders-architecture.md).
 */

export const tasksRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        jobId: z.string().optional(),
        /** completed tasks returned separately, capped */
        doneLimit: z.number().int().min(0).max(100).default(25),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where = {
        workspaceId: ctx.workspace.id,
        ...(input?.jobId && { jobId: input.jobId }),
      };
      const include = {
        job: { select: { id: true, jobNumber: true, propertyAddress: true } },
        assignee: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
      };
      const [open, done] = await Promise.all([
        ctx.prisma.teamTask.findMany({
          where: { ...where, completedAt: null },
          include,
          orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        }),
        ctx.prisma.teamTask.findMany({
          where: { ...where, completedAt: { not: null } },
          include,
          orderBy: { completedAt: "desc" },
          take: input?.doneLimit ?? 25,
        }),
      ]);
      return { open, done };
    }),

  create: workspaceProcedure
    .input(
      z.object({
        title: z.string().min(1).max(300),
        jobId: z.string().nullable().optional(),
        assignedUserId: z.string().nullable().optional(),
        dueAt: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.jobId) {
        const job = await ctx.prisma.job.findFirst({
          where: { id: input.jobId, workspaceId: ctx.workspace.id },
          select: { id: true },
        });
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (input.assignedUserId) {
        const member = await ctx.prisma.workspaceMember.findFirst({
          where: { workspaceId: ctx.workspace.id, userId: input.assignedUserId },
          select: { id: true },
        });
        if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found" });
      }
      return ctx.prisma.teamTask.create({
        data: {
          workspaceId: ctx.workspace.id,
          title: input.title.trim(),
          jobId: input.jobId ?? null,
          assignedUserId: input.assignedUserId ?? null,
          dueAt: input.dueAt ?? null,
          createdByUserId: ctx.user.id,
        },
      });
    }),

  toggle: workspaceProcedure
    .input(z.object({ taskId: z.string(), done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.teamTask.findFirst({
        where: { id: input.taskId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.teamTask.update({
        where: { id: task.id },
        data: input.done
          ? { completedAt: new Date(), completedByUserId: ctx.user.id }
          : { completedAt: null, completedByUserId: null },
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.teamTask.findFirst({
        where: { id: input.taskId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.teamTask.delete({ where: { id: task.id } });
      return { ok: true };
    }),

  /** assignee options — every workspace member */
  teamMembers: workspaceProcedure.query(async ({ ctx }) => {
    const members = await ctx.prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspace.id },
      select: { user: { select: { id: true, fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    });
    return members.map((m) => m.user);
  }),

  /** order picker — search by order #, address or client name */
  searchOrders: workspaceProcedure
    .input(z.object({ search: z.string().min(1).max(120) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.job.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          OR: [
            { jobNumber: { contains: input.search, mode: "insensitive" } },
            { propertyAddress: { contains: input.search, mode: "insensitive" } },
            {
              client: {
                OR: [
                  { firstName: { contains: input.search, mode: "insensitive" } },
                  { lastName: { contains: input.search, mode: "insensitive" } },
                  { company: { contains: input.search, mode: "insensitive" } },
                ],
              },
            },
          ],
        },
        select: {
          id: true,
          jobNumber: true,
          propertyAddress: true,
          propertyCity: true,
          client: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      });
    }),
});

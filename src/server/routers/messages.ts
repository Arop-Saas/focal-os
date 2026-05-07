import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

export const messagesRouter = router({
  // List messages for a job
  list: workspaceProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      // verify job belongs to workspace
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.jobMessage.findMany({
        where: { jobId: input.jobId },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Send a message (staff side)
  send: workspaceProcedure
    .input(
      z.object({
        jobId: z.string(),
        body: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      const senderName = ctx.user.fullName ?? ctx.user.email ?? "Staff";

      return ctx.prisma.jobMessage.create({
        data: {
          jobId: input.jobId,
          workspaceId: ctx.workspace.id,
          senderType: "STAFF",
          senderName,
          body: input.body,
        },
      });
    }),

  // Mark all staff-sent messages as read (called when client views)
  markRead: workspaceProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.jobMessage.updateMany({
        where: {
          jobId: input.jobId,
          workspaceId: ctx.workspace.id,
          senderType: "CLIENT",
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      return { ok: true };
    }),

  // Count unread client messages for a job
  unreadCount: workspaceProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.jobMessage.count({
        where: {
          jobId: input.jobId,
          workspaceId: ctx.workspace.id,
          senderType: "CLIENT",
          readAt: null,
        },
      });
    }),

  // All conversations — one entry per job that has at least one message
  allConversations: workspaceProcedure.query(async ({ ctx }) => {
    // Get all jobs with messages, latest message per job
    const jobs = await ctx.prisma.job.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        messages: { some: {} },
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Get unread counts per job in one query
    const unreadCounts = await ctx.prisma.jobMessage.groupBy({
      by: ["jobId"],
      where: {
        workspaceId: ctx.workspace.id,
        senderType: "CLIENT",
        readAt: null,
      },
      _count: true,
    });

    const unreadMap = new Map(unreadCounts.map((r) => [r.jobId, r._count]));

    return jobs.map((job) => ({
      jobId: job.id,
      jobNumber: job.jobNumber,
      propertyAddress: job.propertyAddress,
      status: job.status,
      client: job.client,
      latestMessage: job.messages[0] ?? null,
      unreadCount: unreadMap.get(job.id) ?? 0,
    }));
  }),

  // Total unread across all jobs in this workspace (for sidebar badge)
  totalUnread: workspaceProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.jobMessage.count({
      where: {
        workspaceId: ctx.workspace.id,
        senderType: "CLIENT",
        readAt: null,
      },
    });
    return { count };
  }),
});

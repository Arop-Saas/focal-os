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
});

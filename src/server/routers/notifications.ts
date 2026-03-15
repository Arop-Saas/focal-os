import { z } from "zod";
import { router, workspaceProcedure } from "../trpc";

export const notificationsRouter = router({
  /** Count of unread in-app notifications for this workspace */
  getUnreadCount: workspaceProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({
      where: {
        workspaceId: ctx.workspace.id,
        channel: "IN_APP",
        readAt: null,
      },
    });
    return { count };
  }),

  /** Mark all in-app notifications as read */
  markAllRead: workspaceProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: {
        workspaceId: ctx.workspace.id,
        channel: "IN_APP",
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }),

  /** Get recent in-app notifications (for a dropdown) */
  listRecent: workspaceProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.notification.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          channel: "IN_APP",
        },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 20,
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          readAt: true,
          createdAt: true,
        },
      });
    }),
});

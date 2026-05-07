import { z } from "zod";
import { router, workspaceProcedure } from "../trpc";
import { nanoid } from "nanoid";

export const teamsRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.customerTeam.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: {
        brokerageGroup: { select: { id: true, name: true, discountType: true, discountValue: true } },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });
  }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.customerTeam.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: {
          brokerageGroup: { select: { id: true, name: true, discountType: true, discountValue: true } },
          members: {
            select: { id: true, firstName: true, lastName: true, email: true, company: true, creditBalance: true },
            orderBy: { lastName: "asc" },
          },
        },
      });
    }),

  create: workspaceProcedure
    .input(z.object({
      name: z.string().min(1),
      notes: z.string().optional(),
      brokerageGroupId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.customerTeam.create({
        data: {
          id: nanoid(),
          workspaceId: ctx.workspace.id,
          name: input.name,
          notes: input.notes,
          brokerageGroupId: input.brokerageGroupId || null,
        },
      });
    }),

  update: workspaceProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      notes: z.string().nullable().optional(),
      credits: z.number().min(0).optional(),
      brokerageGroupId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.customerTeam.update({
        where: { id },
        data,
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Unassign all members first
      await ctx.prisma.client.updateMany({
        where: { teamId: input.id, workspaceId: ctx.workspace.id },
        data: { teamId: null },
      });
      return ctx.prisma.customerTeam.delete({ where: { id: input.id } });
    }),

  addMember: workspaceProcedure
    .input(z.object({ teamId: z.string(), clientId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.client.update({
        where: { id: input.clientId },
        data: { teamId: input.teamId },
      });
    }),

  removeMember: workspaceProcedure
    .input(z.object({ clientId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.client.update({
        where: { id: input.clientId },
        data: { teamId: null },
      });
    }),
});

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

export const territoriesRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.serviceTerritory.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: { createdAt: "asc" },
    });
  }),

  create: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        color: z.string().default("#3B82F6"),
        description: z.string().optional(),
        cities: z.string().optional(),
        travelFee: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.serviceTerritory.create({
        data: {
          workspaceId: ctx.workspace.id,
          name: input.name,
          color: input.color,
          description: input.description,
          cities: input.cities,
          travelFee: input.travelFee,
        },
      });
    }),

  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        color: z.string().optional(),
        description: z.string().optional(),
        cities: z.string().optional(),
        travelFee: z.number().min(0).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const territory = await ctx.prisma.serviceTerritory.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!territory) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      return ctx.prisma.serviceTerritory.update({
        where: { id },
        data,
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const territory = await ctx.prisma.serviceTerritory.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!territory) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.serviceTerritory.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});

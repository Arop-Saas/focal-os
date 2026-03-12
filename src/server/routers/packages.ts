import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

export const packagesRouter = router({
  listServices: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.service.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  }),

  createService: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.enum([
          "PHOTOGRAPHY",
          "VIDEO",
          "DRONE",
          "VIRTUAL_TOUR_3D",
          "FLOOR_PLAN",
          "VIRTUAL_STAGING",
          "TWILIGHT",
          "SOCIAL_MEDIA",
          "RUSH_EDITING",
          "OTHER",
        ]),
        basePrice: z.number().min(0),
        durationMins: z.number().default(60),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.prisma.service.count({
        where: { workspaceId: ctx.workspace.id },
      });
      return ctx.prisma.service.create({
        data: { workspaceId: ctx.workspace.id, ...input, sortOrder: count },
      });
    }),

  updateService: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        basePrice: z.number().min(0).optional(),
        durationMins: z.number().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const service = await ctx.prisma.service.findFirst({
        where: { id, workspaceId: ctx.workspace.id },
      });
      if (!service) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.service.update({ where: { id }, data });
    }),

  deleteService: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = await ctx.prisma.service.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!service) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.service.delete({ where: { id: input.id } });
    }),

  listPackages: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.package.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: {
        items: { include: { service: true } },
        _count: { select: { jobs: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }),

  createPackage: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.number().min(0),
        isActive: z.boolean().default(true),
        isPopular: z.boolean().default(false),
        items: z.array(
          z.object({
            serviceId: z.string(),
            quantity: z.number().default(1),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { items, ...packageData } = input;
      const count = await ctx.prisma.package.count({
        where: { workspaceId: ctx.workspace.id },
      });

      return ctx.prisma.package.create({
        data: {
          workspaceId: ctx.workspace.id,
          ...packageData,
          sortOrder: count,
          items: { create: items },
        },
        include: { items: { include: { service: true } } },
      });
    }),

  updatePackage: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().min(0).optional(),
        isActive: z.boolean().optional(),
        isPopular: z.boolean().optional(),
        items: z
          .array(
            z.object({
              serviceId: z.string(),
              quantity: z.number().default(1),
              notes: z.string().optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, items, ...data } = input;
      const pkg = await ctx.prisma.package.findFirst({
        where: { id, workspaceId: ctx.workspace.id },
      });
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.$transaction(async (tx) => {
        if (items !== undefined) {
          // Replace all items
          await tx.packageItem.deleteMany({ where: { packageId: id } });
          await tx.packageItem.createMany({
            data: items.map((i) => ({ packageId: id, ...i })),
          });
        }

        return tx.package.update({
          where: { id },
          data,
          include: { items: { include: { service: true } } },
        });
      });
    }),

  deletePackage: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const pkg = await ctx.prisma.package.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.package.delete({ where: { id: input.id } });
    }),
});

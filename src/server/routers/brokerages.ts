import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure, managerProcedure } from "../trpc";

export const brokeragesRouter = router({
  // ── List all groups ────────────────────────────────────────────────────────
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.brokerageGroup.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: {
        _count: { select: { clients: true } },
      },
      orderBy: { name: "asc" },
    });
  }),

  // ── Get a single group with its clients ────────────────────────────────────
  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const group = await ctx.prisma.brokerageGroup.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: {
          clients: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
              type: true,
            },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          },
          _count: { select: { clients: true } },
        },
      });
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      return group;
    }),

  // ── Create a group ─────────────────────────────────────────────────────────
  create: managerProcedure
    .input(
      z.object({
        name:          z.string().min(1).max(100),
        discountType:  z.enum(["PERCENTAGE", "FLAT"]).default("PERCENTAGE"),
        discountValue: z.number().min(0).max(100),
        notes:         z.string().optional(),
        isActive:      z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.brokerageGroup.create({
        data: { ...input, workspaceId: ctx.workspace.id },
      });
    }),

  // ── Update a group ─────────────────────────────────────────────────────────
  update: managerProcedure
    .input(
      z.object({
        id:            z.string(),
        name:          z.string().min(1).max(100).optional(),
        discountType:  z.enum(["PERCENTAGE", "FLAT"]).optional(),
        discountValue: z.number().min(0).max(100).optional(),
        notes:         z.string().optional(),
        isActive:      z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.prisma.brokerageGroup.findFirst({
        where: { id, workspaceId: ctx.workspace.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.brokerageGroup.update({
        where: { id },
        data,
      });
    }),

  // ── Delete a group ─────────────────────────────────────────────────────────
  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.brokerageGroup.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      // Unlink all clients before deleting
      await ctx.prisma.client.updateMany({
        where: { brokerageGroupId: input.id },
        data:  { brokerageGroupId: null },
      });

      return ctx.prisma.brokerageGroup.delete({ where: { id: input.id } });
    }),

  // ── Assign a client to a group (or clear with null) ───────────────────────
  assignClient: managerProcedure
    .input(
      z.object({
        clientId:        z.string(),
        brokerageGroupId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.prisma.client.findFirst({
        where: { id: input.clientId, workspaceId: ctx.workspace.id },
      });
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });

      if (input.brokerageGroupId) {
        const group = await ctx.prisma.brokerageGroup.findFirst({
          where: { id: input.brokerageGroupId, workspaceId: ctx.workspace.id },
        });
        if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Brokerage group not found." });
      }

      return ctx.prisma.client.update({
        where: { id: input.clientId },
        data:  { brokerageGroupId: input.brokerageGroupId },
      });
    }),

  // ── Get the effective price for a client + base amount ────────────────────
  // Returns the discounted price and a human-readable description.
  getEffectivePrice: workspaceProcedure
    .input(
      z.object({
        clientId:   z.string(),
        baseAmount: z.number().min(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const client = await ctx.prisma.client.findFirst({
        where: { id: input.clientId, workspaceId: ctx.workspace.id },
        include: { brokerageGroup: true },
      });

      if (!client?.brokerageGroup || !client.brokerageGroup.isActive) {
        return {
          originalAmount: input.baseAmount,
          finalAmount:    input.baseAmount,
          discountAmount: 0,
          discountLabel:  null,
          group:          null,
        };
      }

      const group = client.brokerageGroup;
      let discountAmount = 0;

      if (group.discountType === "PERCENTAGE") {
        discountAmount = parseFloat(
          ((input.baseAmount * group.discountValue) / 100).toFixed(2)
        );
      } else {
        // FLAT — cap at baseAmount so we don't go negative
        discountAmount = Math.min(group.discountValue, input.baseAmount);
      }

      const finalAmount = parseFloat((input.baseAmount - discountAmount).toFixed(2));
      const discountLabel =
        group.discountType === "PERCENTAGE"
          ? `${group.discountValue}% off (${group.name})`
          : `$${group.discountValue.toFixed(2)} off (${group.name})`;

      return {
        originalAmount: input.baseAmount,
        finalAmount,
        discountAmount,
        discountLabel,
        group: {
          id:            group.id,
          name:          group.name,
          discountType:  group.discountType,
          discountValue: group.discountValue,
        },
      };
    }),
});

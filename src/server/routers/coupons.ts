import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, managerProcedure, publicProcedure } from "../trpc";

export const couponsRouter = router({
  // ─── List coupons for workspace ──────────────────────────────────────────────
  list: managerProcedure.query(async ({ ctx }) => {
    return ctx.prisma.coupon.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: { createdAt: "desc" },
    });
  }),

  // ─── Create coupon ───────────────────────────────────────────────────────────
  create: managerProcedure
    .input(
      z.object({
        code: z.string().min(1).max(50).transform((v) => v.toUpperCase().trim()),
        discountType: z.enum(["PERCENTAGE", "FLAT"]),
        discountValue: z.number().min(0),
        maxUses: z.number().int().min(1).nullish(),
        expiresAt: z.string().nullish(), // ISO date string
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate code in workspace
      const existing = await ctx.prisma.coupon.findUnique({
        where: {
          workspaceId_code: {
            workspaceId: ctx.workspace.id,
            code: input.code,
          },
        },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A coupon with this code already exists",
        });
      }
      return ctx.prisma.coupon.create({
        data: {
          workspaceId: ctx.workspace.id,
          code: input.code,
          discountType: input.discountType,
          discountValue: input.discountValue,
          maxUses: input.maxUses ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
    }),

  // ─── Update coupon ───────────────────────────────────────────────────────────
  update: managerProcedure
    .input(
      z.object({
        id: z.string(),
        code: z.string().min(1).max(50).transform((v) => v.toUpperCase().trim()).optional(),
        discountType: z.enum(["PERCENTAGE", "FLAT"]).optional(),
        discountValue: z.number().min(0).optional(),
        maxUses: z.number().int().min(1).nullish(),
        expiresAt: z.string().nullish(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const coupon = await ctx.prisma.coupon.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!coupon) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, expiresAt, ...rest } = input;
      return ctx.prisma.coupon.update({
        where: { id },
        data: {
          ...rest,
          ...(expiresAt !== undefined && {
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          }),
        },
      });
    }),

  // ─── Delete coupon ───────────────────────────────────────────────────────────
  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const coupon = await ctx.prisma.coupon.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!coupon) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.coupon.delete({ where: { id: input.id } });
    }),

  // ─── Validate coupon (public, customer-facing) ──────────────────────────────
  validate: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        code: z.string().transform((v) => v.toUpperCase().trim()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { slug: input.slug },
      });
      if (!workspace) {
        return { valid: false as const, message: "Invalid workspace" };
      }
      const coupon = await ctx.prisma.coupon.findUnique({
        where: {
          workspaceId_code: {
            workspaceId: workspace.id,
            code: input.code,
          },
        },
      });
      if (!coupon || !coupon.isActive) {
        return { valid: false as const, message: "Invalid promo code" };
      }
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        return { valid: false as const, message: "This promo code has expired" };
      }
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return { valid: false as const, message: "This promo code has reached its usage limit" };
      }
      return {
        valid: true as const,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        code: coupon.code,
      };
    }),
});

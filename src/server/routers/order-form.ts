import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure, ownerProcedure } from "../trpc";
import { DEFAULT_BOOKING_FORM_SETTINGS } from "@/lib/booking-form-types";

const fieldSettingsSchema = z.object({
  propertyType: z.object({ visible: z.boolean(), required: z.boolean() }),
  sqft:         z.object({ visible: z.boolean(), required: z.boolean() }),
  beds:         z.object({ visible: z.boolean(), required: z.boolean() }),
  baths:        z.object({ visible: z.boolean(), required: z.boolean() }),
  mlsNumber:    z.object({ visible: z.boolean(), required: z.boolean() }),
  accessNotes:  z.object({ visible: z.boolean(), required: z.boolean() }),
  phone:        z.object({ visible: z.boolean(), required: z.boolean() }),
  company:      z.object({ visible: z.boolean(), required: z.boolean() }),
  clientNotes:  z.object({ visible: z.boolean(), required: z.boolean() }),
  gridColumns:  z.number().int().min(3).max(5).optional(),
  orderDetails: z.object({
    showCouponField:     z.boolean().optional(),
    showPriceBreakdown:  z.boolean().optional(),
    showTotal:           z.boolean().optional(),
    taxRate:             z.number().optional(),
    taxLabel:            z.string().optional(),
    showLineItemDetails: z.boolean().optional(),
  }).optional(),
}).optional();

export const orderFormRouter = router({

  // ─── List all order forms for workspace ─────────────────────────────────────
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.orderForm.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }),

  // ─── Get a single order form ─────────────────────────────────────────────────
  get: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const form = await ctx.prisma.orderForm.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: { territories: { select: { id: true, name: true, color: true } } },
      });
      if (!form) throw new TRPCError({ code: "NOT_FOUND" });
      return form;
    }),

  // ─── Create ──────────────────────────────────────────────────────────────────
  create: ownerProcedure
    .input(z.object({ title: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.prisma.orderForm.count({
        where: { workspaceId: ctx.workspace.id },
      });
      return ctx.prisma.orderForm.create({
        data: {
          workspaceId: ctx.workspace.id,
          title: input.title,
          fieldSettings: DEFAULT_BOOKING_FORM_SETTINGS.fields,
          sortOrder: count,
        },
      });
    }),

  // ─── Update general settings ─────────────────────────────────────────────────
  updateGeneral: ownerProcedure
    .input(z.object({
      id:             z.string(),
      title:          z.string().min(1).max(100).optional(),
      description:    z.string().max(300).optional().nullable(),
      coverImage:     z.string().max(2000).optional().nullable(),
      welcomeMessage: z.string().max(500).optional(),
      isPublic:       z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertOwns(ctx, id);
      return ctx.prisma.orderForm.update({ where: { id }, data });
    }),

  // ─── Update field visibility ──────────────────────────────────────────────────
  updateFields: ownerProcedure
    .input(z.object({ id: z.string(), fieldSettings: fieldSettingsSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertOwns(ctx, input.id);
      return ctx.prisma.orderForm.update({
        where: { id: input.id },
        data: { fieldSettings: input.fieldSettings },
      });
    }),

  // ─── Update scheduling settings ───────────────────────────────────────────────
  updateScheduling: ownerProcedure
    .input(z.object({
      id:                  z.string(),
      confirmationMode:    z.enum(["IMMEDIATE", "MANUAL"]).optional(),
      assignmentStrategy:  z.enum(["ROUND_ROBIN", "CLOSEST", "PRIORITY", "AUTO"]).optional(),
      allowCustomerChoice: z.boolean().optional(),
      timeSlotInterval:    z.number().int().min(15).max(120).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertOwns(ctx, id);
      return ctx.prisma.orderForm.update({ where: { id }, data });
    }),

  // ─── Update payment settings ──────────────────────────────────────────────────
  updatePayment: ownerProcedure
    .input(z.object({
      id:            z.string(),
      paymentMode:   z.enum(["NONE", "FULL", "PARTIAL"]),
      depositPercent: z.number().int().min(1).max(99).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertOwns(ctx, id);
      return ctx.prisma.orderForm.update({ where: { id }, data });
    }),

  // ─── Update appearance (designer) ──────────────────────────────────────────────
  updateAppearance: ownerProcedure
    .input(z.object({
      id:              z.string(),
      accentColor:     z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      logoUrl:         z.string().url().optional().nullable(),
      fontFamily:      z.enum(["Inter", "System", "Serif", "Mono"]).optional(),
      buttonStyle:     z.enum(["rounded", "pill", "square"]).optional(),
      showLogo:        z.boolean().optional(),
      showStepNumbers: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertOwns(ctx, id);
      return ctx.prisma.orderForm.update({ where: { id }, data });
    }),

  // ─── Update SEO settings ──────────────────────────────────────────────────────
  updateSeo: ownerProcedure
    .input(z.object({
      id:             z.string(),
      seoTitle:       z.string().max(120).optional().nullable(),
      seoDescription: z.string().max(300).optional().nullable(),
      seoImage:       z.string().url().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertOwns(ctx, id);
      return ctx.prisma.orderForm.update({ where: { id }, data });
    }),

  // ─── Update custom fields ──────────────────────────────────────────────────────
  updateCustomFields: ownerProcedure
    .input(z.object({
      id: z.string(),
      customFields: z.array(z.object({
        id:          z.string(),
        type:        z.enum(["text", "textarea", "dropdown", "checkbox", "select", "multiselect", "description", "number", "date"]),
        label:       z.string().min(1).max(200),
        placeholder: z.string().max(200).optional(),
        helpText:    z.string().max(500).optional(),
        required:    z.boolean(),
        options:     z.array(z.string().max(200)).max(50).optional(),
        step:        z.number().int().min(1).max(5),
        sortOrder:   z.number().int(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertOwns(ctx, input.id);
      return ctx.prisma.orderForm.update({
        where: { id: input.id },
        data: { customFields: input.customFields },
      });
    }),

  // ─── Update linked territories ──────────────────────────────────────────────
  updateTerritories: ownerProcedure
    .input(z.object({
      id: z.string(),
      territoryIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertOwns(ctx, input.id);
      return ctx.prisma.orderForm.update({
        where: { id: input.id },
        data: {
          territories: { set: input.territoryIds.map((id) => ({ id })) },
        },
        include: { territories: { select: { id: true, name: true, color: true } } },
      });
    }),

  // ─── Delete ───────────────────────────────────────────────────────────────────
  delete: ownerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwns(ctx, input.id);
      await ctx.prisma.orderForm.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});

async function assertOwns(
  ctx: { prisma: typeof import("@/lib/prisma").default; workspace: { id: string } },
  formId: string
) {
  const form = await ctx.prisma.orderForm.findFirst({
    where: { id: formId, workspaceId: ctx.workspace.id },
    select: { id: true },
  });
  if (!form) throw new TRPCError({ code: "NOT_FOUND" });
}

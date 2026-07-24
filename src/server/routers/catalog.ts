import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure, adminProcedure } from "../trpc";
import { quoteOrderLines } from "@/lib/orders/pricing";

/**
 * Services & Pricing catalog (docs/services-products-plan.md, Phase 1).
 * Items are versioned: edits create a new CatalogItemVersion and move
 * currentVersionId — existing OrderLineSnapshots keep pointing at the
 * version that was purchased. Legacy Service/Package rows are back-synced
 * on edit so old surfaces (booking form, admin form) stay consistent
 * until they migrate to the catalog.
 */

const VISIT_MODES = ["NONE", "SAME_VISIT", "SEPARATE_VISIT"] as const;
const FULFILLMENT_MODES = ["ON_SITE", "PRODUCTION_ONLY", "HYBRID"] as const;
const ROLES = ["MAIN", "ADD_ON", "PACKAGE"] as const;

export const catalogRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        role: z.enum(ROLES).optional(),
        state: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.catalogItem.findMany({
        where: {
          workspaceId: ctx.workspace!.id,
          ...(input?.role && { role: input.role }),
          ...(input?.state && { state: input.state }),
        },
        include: {
          currentVersion: true,
          _count: { select: { offerings: true, rules: true, packageComponents: true } },
        },
        orderBy: [{ state: "asc" }, { updatedAt: "desc" }],
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(2).max(120),
        role: z.enum(ROLES).default("MAIN"),
        category: z.string().max(60).optional(),
        description: z.string().max(2000).optional(),
        basePrice: z.number().min(0).default(0),
        baseDurationMins: z.number().int().min(0).max(24 * 60).default(60),
        visitMode: z.enum(VISIT_MODES).default("SAME_VISIT"),
        fulfillmentMode: z.enum(FULFILLMENT_MODES).default("ON_SITE"),
        solarConstraint: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const item = await tx.catalogItem.create({
          data: {
            workspaceId: ctx.workspace!.id,
            role: input.role,
            state: "DRAFT",
            category: input.category ?? null,
          },
        });
        const version = await tx.catalogItemVersion.create({
          data: {
            itemId: item.id,
            versionNumber: 1,
            name: input.name,
            description: input.description ?? null,
            basePrice: input.basePrice,
            baseDurationMins: input.baseDurationMins,
            visitMode: input.visitMode,
            fulfillmentMode: input.fulfillmentMode,
            solarConstraint: input.solarConstraint,
            // PRODUCTION_ONLY/HYBRID items generate an editing task by default
            productionTaskType: input.fulfillmentMode === "ON_SITE" ? null : "PHOTO_EDITING",
          },
        });
        return tx.catalogItem.update({
          where: { id: item.id },
          data: { currentVersionId: version.id },
          include: { currentVersion: true },
        });
      });
    }),

  setState: adminProcedure
    .input(z.object({ id: z.string(), state: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.catalogItem.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace!.id },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.state === "PUBLISHED" && !item.currentVersionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Set up the service before publishing." });
      }
      return ctx.prisma.catalogItem.update({ where: { id: item.id }, data: { state: input.state } });
    }),

  /** Edits create a NEW version (snapshots keep the old one) + back-sync legacy rows. */
  updateItem: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(120).optional(),
        category: z.string().max(60).nullable().optional(),
        description: z.string().max(2000).nullable().optional(),
        basePrice: z.number().min(0).optional(),
        baseDurationMins: z.number().int().min(0).max(24 * 60).optional(),
        visitMode: z.enum(VISIT_MODES).optional(),
        fulfillmentMode: z.enum(FULFILLMENT_MODES).optional(),
        solarConstraint: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.catalogItem.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace!.id },
        include: { currentVersion: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      });
      if (!item?.currentVersion) throw new TRPCError({ code: "NOT_FOUND" });
      const cur = item.currentVersion;
      const nextNumber = (item.versions[0]?.versionNumber ?? cur.versionNumber) + 1;

      return ctx.prisma.$transaction(async (tx) => {
        const version = await tx.catalogItemVersion.create({
          data: {
            itemId: item.id,
            versionNumber: nextNumber,
            name: input.name ?? cur.name,
            description: input.description === undefined ? cur.description : input.description,
            imageUrl: cur.imageUrl,
            pricingMode: cur.pricingMode,
            basePrice: input.basePrice ?? cur.basePrice,
            unitLabel: cur.unitLabel,
            fulfillmentMode: input.fulfillmentMode ?? cur.fulfillmentMode,
            visitMode: input.visitMode ?? cur.visitMode,
            baseDurationMins: input.baseDurationMins ?? cur.baseDurationMins,
            requiredSkills: cur.requiredSkills,
            productionTaskType: cur.productionTaskType,
            solarConstraint: input.solarConstraint ?? cur.solarConstraint,
          },
        });
        await tx.catalogItem.update({
          where: { id: item.id },
          data: {
            currentVersionId: version.id,
            ...(input.category !== undefined && { category: input.category }),
          },
        });

        // Back-sync the bridged legacy row so pre-catalog surfaces agree
        if (item.legacyServiceId) {
          await tx.service.updateMany({
            where: { id: item.legacyServiceId, workspaceId: ctx.workspace!.id },
            data: {
              name: version.name,
              description: version.description,
              basePrice: version.basePrice,
              durationMins: version.baseDurationMins,
            },
          });
        }
        if (item.legacyPackageId) {
          await tx.package.updateMany({
            where: { id: item.legacyPackageId, workspaceId: ctx.workspace!.id },
            data: {
              name: version.name,
              description: version.description,
              price: version.basePrice,
              durationMins: version.baseDurationMins,
            },
          });
        }
        return version;
      });
    }),

  listRules: workspaceProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.productRule.findMany({
        where: { workspaceId: ctx.workspace!.id, itemId: input.itemId },
        orderBy: { priority: "asc" },
      });
    }),

  addRule: adminProcedure
    .input(
      z.object({
        itemId: z.string(),
        name: z.string().min(2).max(160),
        conditionMin: z.number().min(0).nullable().optional(),
        conditionMax: z.number().min(0).nullable().optional(),
        priceAdd: z.number().default(0),
        durationAddMins: z.number().int().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.catalogItem.findFirst({
        where: { id: input.itemId, workspaceId: ctx.workspace!.id },
        select: { id: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.productRule.create({
        data: {
          workspaceId: ctx.workspace!.id,
          itemId: input.itemId,
          name: input.name,
          conditionType: "SQFT_RANGE",
          conditionMin: input.conditionMin ?? null,
          conditionMax: input.conditionMax ?? null,
          priceAdd: input.priceAdd,
          durationAddMins: input.durationAddMins,
        },
      });
    }),

  deleteRule: adminProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.productRule.findFirst({
        where: { id: input.ruleId, workspaceId: ctx.workspace!.id },
      });
      if (!rule) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.productRule.delete({ where: { id: rule.id } });
    }),

  getItem: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.catalogItem.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace!.id },
        include: { currentVersion: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  /** Order forms available for offerings (id + title only). */
  listOrderForms: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.orderForm.findMany({
      where: { workspaceId: ctx.workspace!.id },
      select: { id: true, title: true },
      orderBy: { sortOrder: "asc" },
    });
  }),

  listOfferings: workspaceProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.offering.findMany({
        where: { workspaceId: ctx.workspace!.id, itemId: input.itemId },
        select: { id: true, orderFormId: true, visible: true },
      });
    }),

  /** Toggle whether an item is offered on an order form. */
  setOffering: adminProcedure
    .input(z.object({ itemId: z.string(), orderFormId: z.string(), offered: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [item, form] = await Promise.all([
        ctx.prisma.catalogItem.findFirst({
          where: { id: input.itemId, workspaceId: ctx.workspace!.id }, select: { id: true },
        }),
        ctx.prisma.orderForm.findFirst({
          where: { id: input.orderFormId, workspaceId: ctx.workspace!.id }, select: { id: true },
        }),
      ]);
      if (!item || !form) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.offered) {
        return ctx.prisma.offering.upsert({
          where: { itemId_orderFormId: { itemId: input.itemId, orderFormId: input.orderFormId } },
          create: { workspaceId: ctx.workspace!.id, itemId: input.itemId, orderFormId: input.orderFormId },
          update: { visible: true },
        });
      }
      await ctx.prisma.offering.deleteMany({
        where: { itemId: input.itemId, orderFormId: input.orderFormId },
      });
      return { removed: true };
    }),

  listComponents: workspaceProcedure
    .input(z.object({ packageItemId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.packageComponent.findMany({
        where: { packageItemId: input.packageItemId, package: { workspaceId: ctx.workspace!.id } },
        include: { child: { include: { currentVersion: true } } },
      });
    }),

  addComponent: adminProcedure
    .input(z.object({ packageItemId: z.string(), childItemId: z.string(), quantity: z.number().int().min(1).max(99).default(1) }))
    .mutation(async ({ ctx, input }) => {
      if (input.packageItemId === input.childItemId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A package cannot contain itself." });
      }
      const [parent, child] = await Promise.all([
        ctx.prisma.catalogItem.findFirst({ where: { id: input.packageItemId, workspaceId: ctx.workspace!.id } }),
        ctx.prisma.catalogItem.findFirst({ where: { id: input.childItemId, workspaceId: ctx.workspace!.id } }),
      ]);
      if (!parent || !child) throw new TRPCError({ code: "NOT_FOUND" });
      if (parent.role !== "PACKAGE") throw new TRPCError({ code: "BAD_REQUEST", message: "Components can only be added to packages." });
      if (child.role === "PACKAGE") throw new TRPCError({ code: "BAD_REQUEST", message: "Packages cannot contain other packages." });

      return ctx.prisma.packageComponent.upsert({
        where: { packageItemId_childItemId: { packageItemId: input.packageItemId, childItemId: input.childItemId } },
        create: { packageItemId: input.packageItemId, childItemId: input.childItemId, quantity: input.quantity },
        update: { quantity: input.quantity },
      });
    }),

  removeComponent: adminProcedure
    .input(z.object({ componentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comp = await ctx.prisma.packageComponent.findFirst({
        where: { id: input.componentId, package: { workspaceId: ctx.workspace!.id } },
      });
      if (!comp) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.packageComponent.delete({ where: { id: comp.id } });
    }),

  // ── Pricing plans (Phase 2 §11) ──────────────────────────────────────────
  listPlans: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.pricingPlan.findMany({
      where: { workspaceId: ctx.workspace!.id },
      include: {
        brokerageGroup: { select: { name: true } },
        client: { select: { firstName: true, lastName: true } },
        entries: {
          include: { item: { include: { currentVersion: { select: { name: true, basePrice: true } } } } },
        },
      },
      orderBy: [{ active: "desc" }, { priority: "asc" }],
    });
  }),

  createPlan: adminProcedure
    .input(z.object({
      name: z.string().min(2).max(80),
      brokerageGroupId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.brokerageGroupId) {
        const grp = await ctx.prisma.brokerageGroup.findFirst({
          where: { id: input.brokerageGroupId, workspaceId: ctx.workspace!.id }, select: { id: true },
        });
        if (!grp) throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.prisma.pricingPlan.create({
        data: {
          workspaceId: ctx.workspace!.id,
          name: input.name,
          brokerageGroupId: input.brokerageGroupId ?? null,
        },
      });
    }),

  setPlanActive: adminProcedure
    .input(z.object({ planId: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.prisma.pricingPlan.findFirst({
        where: { id: input.planId, workspaceId: ctx.workspace!.id },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.pricingPlan.update({ where: { id: plan.id }, data: { active: input.active } });
    }),

  deletePlan: adminProcedure
    .input(z.object({ planId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.prisma.pricingPlan.findFirst({
        where: { id: input.planId, workspaceId: ctx.workspace!.id },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.pricingPlan.delete({ where: { id: plan.id } });
    }),

  upsertPlanEntry: adminProcedure
    .input(z.object({
      planId: z.string(),
      catalogItemId: z.string(),
      overridePrice: z.number().min(0).nullable().optional(),
      percentAdjust: z.number().min(-100).max(500).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [plan, item] = await Promise.all([
        ctx.prisma.pricingPlan.findFirst({ where: { id: input.planId, workspaceId: ctx.workspace!.id }, select: { id: true } }),
        ctx.prisma.catalogItem.findFirst({ where: { id: input.catalogItemId, workspaceId: ctx.workspace!.id }, select: { id: true } }),
      ]);
      if (!plan || !item) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.overridePrice == null && input.percentAdjust == null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Set a price or a percentage." });
      }
      return ctx.prisma.pricingPlanEntry.upsert({
        where: { planId_catalogItemId: { planId: input.planId, catalogItemId: input.catalogItemId } },
        create: {
          planId: input.planId,
          catalogItemId: input.catalogItemId,
          overridePrice: input.overridePrice ?? null,
          percentAdjust: input.overridePrice != null ? null : input.percentAdjust ?? null,
        },
        update: {
          overridePrice: input.overridePrice ?? null,
          percentAdjust: input.overridePrice != null ? null : input.percentAdjust ?? null,
        },
      });
    }),

  deletePlanEntry: adminProcedure
    .input(z.object({ entryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.pricingPlanEntry.findFirst({
        where: { id: input.entryId, plan: { workspaceId: ctx.workspace!.id } },
      });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.pricingPlanEntry.delete({ where: { id: entry.id } });
    }),

  listBrokerageGroups: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.brokerageGroup.findMany({
      where: { workspaceId: ctx.workspace!.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }),

  // ── Order-level adjustments (rush / after-hours / weekend / minimum) ──
  listAdjustments: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.adjustmentPolicy.findMany({
      where: { workspaceId: ctx.workspace!.id },
      orderBy: { type: "asc" },
    });
  }),

  upsertAdjustment: adminProcedure
    .input(z.object({
      type: z.enum(["RUSH", "AFTER_HOURS", "WEEKEND", "MINIMUM_ORDER"]),
      active: z.boolean(),
      amountType: z.enum(["FLAT", "PERCENT"]).default("FLAT"),
      amount: z.number().min(0).default(0),
      afterHoursStart: z.number().int().min(0).max(23).nullable().optional(),
      afterHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
      minimumOrderAmount: z.number().min(0).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { type, ...data } = input;
      return ctx.prisma.adjustmentPolicy.upsert({
        where: { workspaceId_type: { workspaceId: ctx.workspace!.id, type } },
        create: { workspaceId: ctx.workspace!.id, type, ...data },
        update: data,
      });
    }),

  /** Test console: quote a hypothetical order and see the explanation. */
  quotePreview: workspaceProcedure
    .input(
      z.object({
        squareFootage: z.number().min(0).nullable().optional(),
        clientId: z.string().nullable().optional(),
        lines: z
          .array(
            z.object({
              catalogItemId: z.string(),
              quantity: z.number().int().min(1).default(1),
            })
          )
          .min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      return quoteOrderLines(ctx.prisma, {
        workspaceId: ctx.workspace!.id,
        squareFootage: input.squareFootage ?? null,
        clientId: input.clientId ?? null,
        lines: input.lines,
      });
    }),
});

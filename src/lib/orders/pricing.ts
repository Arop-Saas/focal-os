import type { FulfillmentMode, Prisma, PrismaClient, ProductionTaskType, VisitMode } from "@prisma/client";

/**
 * THE pricing service (docs/services-products-plan.md §11).
 * Every surface that prices an order — admin create, booking, mobile,
 * invoices, quotes — must call this. Never reimplement the math.
 *
 * v1 pipeline: resolve catalog item (directly or via legacy Service/Package
 * bridge) → base price/duration from the current version → apply active
 * SQFT_RANGE product rules → explain every step. Admin price overrides win
 * but are recorded in the explanation.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export interface QuoteLineInput {
  catalogItemId?: string;
  /** legacy Service id (bridged via CatalogItem.legacyServiceId) */
  serviceId?: string;
  /** legacy Package id (bridged via CatalogItem.legacyPackageId) */
  packageId?: string;
  quantity?: number;
  /** admin-edited unit price — wins over the computed price */
  unitPriceOverride?: number;
  /** free-text line with no catalog identity */
  customName?: string;
}

export interface QuotedLine {
  catalogItemId: string | null;
  versionId: string | null;
  source: "CATALOG" | "LEGACY_SERVICE" | "CUSTOM";
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  durationMins: number;
  visitMode: VisitMode;
  fulfillmentMode: FulfillmentMode;
  productionTaskType: ProductionTaskType | null;
  explanation: string[];
}

export async function quoteOrderLines(
  db: Db,
  args: { workspaceId: string; squareFootage?: number | null; clientId?: string | null; lines: QuoteLineInput[] }
): Promise<{ lines: QuotedLine[]; subtotal: number }> {
  const sqft = args.squareFootage ?? null;
  const out: QuotedLine[] = [];

  // Rule-based pricing is opt-in (Services & Pricing → Pricing)
  const ws = await db.workspace.findUnique({
    where: { id: args.workspaceId },
    select: { pricingRulesEnabled: true },
  });
  const rulesEnabled = ws?.pricingRulesEnabled ?? false;

  // Pricing plans (plan §11): plans targeting this client, their brokerage
  // group, or everyone — lowest priority number wins; the first matching
  // plan that has an entry for an item applies to it.
  let plans: {
    name: string;
    entries: { catalogItemId: string; overridePrice: number | null; percentAdjust: number | null }[];
  }[] = [];
  if (args.clientId) {
    const client = await db.client.findFirst({
      where: { id: args.clientId, workspaceId: args.workspaceId },
      select: { id: true, brokerageGroupId: true },
    });
    plans = await db.pricingPlan.findMany({
      where: {
        workspaceId: args.workspaceId,
        active: true,
        OR: [
          { clientId: args.clientId },
          ...(client?.brokerageGroupId ? [{ brokerageGroupId: client.brokerageGroupId }] : []),
          { clientId: null, brokerageGroupId: null },
        ],
      },
      orderBy: { priority: "asc" },
      select: { name: true, entries: { select: { catalogItemId: true, overridePrice: true, percentAdjust: true } } },
    });
  } else {
    plans = await db.pricingPlan.findMany({
      where: { workspaceId: args.workspaceId, active: true, clientId: null, brokerageGroupId: null },
      orderBy: { priority: "asc" },
      select: { name: true, entries: { select: { catalogItemId: true, overridePrice: true, percentAdjust: true } } },
    });
  }

  for (const input of args.lines) {
    const quantity = Math.max(1, input.quantity ?? 1);

    const item = input.catalogItemId
      ? await db.catalogItem.findFirst({
          where: { id: input.catalogItemId, workspaceId: args.workspaceId },
          include: { currentVersion: true, rules: { where: { active: true } } },
        })
      : input.serviceId
        ? await db.catalogItem.findFirst({
            where: { legacyServiceId: input.serviceId, workspaceId: args.workspaceId },
            include: { currentVersion: true, rules: { where: { active: true } } },
          })
        : input.packageId
          ? await db.catalogItem.findFirst({
              where: { legacyPackageId: input.packageId, workspaceId: args.workspaceId },
              include: { currentVersion: true, rules: { where: { active: true } } },
            })
          : null;

    if (!item?.currentVersion) {
      // No catalog identity — custom line, price must come from the caller
      const unitPrice = input.unitPriceOverride ?? 0;
      out.push({
        catalogItemId: null,
        versionId: null,
        source: "CUSTOM",
        name: input.customName ?? "Custom item",
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
        durationMins: 0,
        visitMode: "SAME_VISIT",
        fulfillmentMode: "ON_SITE",
        productionTaskType: null,
        explanation: ["Custom line — price entered manually"],
      });
      continue;
    }

    const v = item.currentVersion;
    const explanation: string[] = [`Base price $${v.basePrice.toFixed(2)}`];
    let unitPrice = v.basePrice;
    let durationMins = v.baseDurationMins;

    // SQFT_RANGE rules (sorted by priority; cumulative) — only when enabled
    const rules = (rulesEnabled ? item.rules : [])
      .filter((r) => r.conditionType === "SQFT_RANGE")
      .sort((a, b) => a.priority - b.priority);
    for (const rule of rules) {
      if (sqft == null) continue;
      const min = rule.conditionMin ?? -Infinity;
      const max = rule.conditionMax ?? Infinity;
      if (sqft >= min && sqft <= max) {
        unitPrice += rule.priceAdd;
        durationMins += rule.durationAddMins;
        const parts: string[] = [];
        if (rule.priceAdd !== 0) parts.push(`${rule.priceAdd > 0 ? "+" : "−"}$${Math.abs(rule.priceAdd).toFixed(2)}`);
        if (rule.durationAddMins !== 0) parts.push(`${rule.durationAddMins > 0 ? "+" : "−"}${Math.abs(rule.durationAddMins)} min`);
        explanation.push(`${rule.name}: ${parts.join(", ") || "applied"}`);
      }
    }

    // First matching pricing plan with an entry for this item
    for (const plan of plans) {
      const entry = plan.entries.find((e) => e.catalogItemId === item.id);
      if (!entry) continue;
      if (entry.overridePrice != null) {
        explanation.push(`${plan.name}: price set to $${entry.overridePrice.toFixed(2)}`);
        unitPrice = entry.overridePrice;
      } else if (entry.percentAdjust != null && entry.percentAdjust !== 0) {
        const adjusted = Math.max(0, unitPrice * (1 + entry.percentAdjust / 100));
        explanation.push(`${plan.name}: ${entry.percentAdjust > 0 ? "+" : ""}${entry.percentAdjust}% → $${adjusted.toFixed(2)}`);
        unitPrice = adjusted;
      }
      break;
    }

    if (input.unitPriceOverride != null && input.unitPriceOverride !== unitPrice) {
      explanation.push(`Price set manually to $${input.unitPriceOverride.toFixed(2)} (computed $${unitPrice.toFixed(2)})`);
      unitPrice = input.unitPriceOverride;
    }

    out.push({
      catalogItemId: item.id,
      versionId: v.id,
      source: input.catalogItemId ? "CATALOG" : "LEGACY_SERVICE",
      name: v.name,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
      durationMins,
      visitMode: v.visitMode,
      fulfillmentMode: v.fulfillmentMode,
      productionTaskType: v.productionTaskType,
      explanation,
    });
  }

  return { lines: out, subtotal: out.reduce((sum, l) => sum + l.totalPrice, 0) };
}

/**
 * Persist snapshots for a job and generate downstream work
 * (fulfillment blueprint §13, v1 scope):
 * - PRODUCTION_ONLY / HYBRID lines → a ProductionTask (WAITING_FILES)
 * - SEPARATE_VISIT lines → an unscheduled non-primary Appointment
 * Backfilled legacy items are all SAME_VISIT + ON_SITE, so existing
 * behaviour is unchanged until items opt in.
 */
export async function snapshotAndGenerate(
  db: Db,
  args: { workspaceId: string; jobId: string; lines: QuotedLine[] }
): Promise<void> {
  for (const line of args.lines) {
    await db.orderLineSnapshot.create({
      data: {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        catalogItemId: line.catalogItemId,
        versionId: line.versionId,
        source: line.source,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        totalPrice: line.totalPrice,
        durationMins: line.durationMins,
        visitMode: line.visitMode,
        fulfillmentMode: line.fulfillmentMode,
        explanation: line.explanation,
      },
    });

    if (line.fulfillmentMode === "PRODUCTION_ONLY" || line.fulfillmentMode === "HYBRID") {
      await db.productionTask.create({
        data: {
          workspaceId: args.workspaceId,
          jobId: args.jobId,
          type: line.productionTaskType ?? "OTHER",
          title: line.name,
          status: "WAITING_FILES",
        },
      });
    }

    if (line.visitMode === "SEPARATE_VISIT") {
      await db.appointment.create({
        data: {
          workspaceId: args.workspaceId,
          jobId: args.jobId,
          title: line.name,
          scheduledAt: null,
          durationMins: line.durationMins || 60,
          isPrimary: false,
        },
      });
    }
  }
}

/**
 * Order-level adjustments (plan §11): rush, after-hours, weekend, minimum
 * order. Applied to the line subtotal AFTER plans/rules, BEFORE tax. Time
 * conditions are evaluated on the workspace's wall clock.
 */
export interface OrderAdjustment {
  type: "RUSH" | "AFTER_HOURS" | "WEEKEND" | "MINIMUM_ORDER";
  label: string;
  amount: number;
}

export async function applyOrderAdjustments(
  db: Db,
  args: {
    workspaceId: string;
    subtotal: number;
    scheduledAt?: Date | null;
    isRush?: boolean;
  }
): Promise<{ adjustments: OrderAdjustment[]; adjustedSubtotal: number }> {
  const policies = await db.adjustmentPolicy.findMany({
    where: { workspaceId: args.workspaceId, active: true },
  });
  if (policies.length === 0) return { adjustments: [], adjustedSubtotal: args.subtotal };

  const ws = await db.workspace.findUnique({
    where: { id: args.workspaceId },
    select: { timezone: true },
  });
  const tz = ws?.timezone ?? "America/New_York";

  // Wall-clock hour/day of the shoot in the workspace timezone
  let wallHour: number | null = null;
  let wallDow: number | null = null;
  if (args.scheduledAt) {
    const { utcToWallParts, wallDateDayOfWeek, utcToWallDateISO } = await import("@/lib/scheduling/tz");
    const parts = utcToWallParts(new Date(args.scheduledAt), tz);
    wallHour = parts.hour;
    wallDow = wallDateDayOfWeek(utcToWallDateISO(new Date(args.scheduledAt), tz));
  }

  const adjustments: OrderAdjustment[] = [];
  policies.sort((a, b) => (a.type === "MINIMUM_ORDER" ? 1 : 0) - (b.type === "MINIMUM_ORDER" ? 1 : 0));
  const fee = (p: { amountType: string; amount: number }) =>
    p.amountType === "PERCENT" ? (args.subtotal * p.amount) / 100 : p.amount;

  for (const p of policies) {
    switch (p.type) {
      case "RUSH":
        if (args.isRush) {
          adjustments.push({ type: "RUSH", label: "Rush fee", amount: fee(p) });
        }
        break;
      case "AFTER_HOURS": {
        if (wallHour == null) break;
        const start = p.afterHoursStart ?? 18;
        const end = p.afterHoursEnd ?? 8;
        if (wallHour >= start || wallHour < end) {
          adjustments.push({ type: "AFTER_HOURS", label: "After-hours fee", amount: fee(p) });
        }
        break;
      }
      case "WEEKEND":
        if (wallDow === 0 || wallDow === 6) {
          adjustments.push({ type: "WEEKEND", label: "Weekend fee", amount: fee(p) });
        }
        break;
      case "MINIMUM_ORDER": {
        const min = p.minimumOrderAmount ?? 0;
        const runningTotal = args.subtotal + adjustments.reduce((s, a) => s + a.amount, 0);
        if (min > 0 && runningTotal < min) {
          adjustments.push({ type: "MINIMUM_ORDER", label: "Minimum order", amount: min - runningTotal });
        }
        break;
      }
    }
  }

  return {
    adjustments,
    adjustedSubtotal: args.subtotal + adjustments.reduce((s, a) => s + a.amount, 0),
  };
}

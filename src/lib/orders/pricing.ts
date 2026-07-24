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
  args: { workspaceId: string; squareFootage?: number | null; lines: QuoteLineInput[] }
): Promise<{ lines: QuotedLine[]; subtotal: number }> {
  const sqft = args.squareFootage ?? null;
  const out: QuotedLine[] = [];

  // Rule-based pricing is opt-in (Services & Pricing → Pricing)
  const ws = await db.workspace.findUnique({
    where: { id: args.workspaceId },
    select: { pricingRulesEnabled: true },
  });
  const rulesEnabled = ws?.pricingRulesEnabled ?? false;

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

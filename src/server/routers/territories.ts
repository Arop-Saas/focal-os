import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure, publicProcedure } from "../trpc";

const coordinatePair = z.tuple([z.number(), z.number()]); // [lng, lat]

const boundaryInput = z.discriminatedUnion("boundaryType", [
  z.object({ boundaryType: z.literal("none") }),
  z.object({
    boundaryType: z.literal("polygon"),
    polygonCoords: z.array(coordinatePair).min(3),
  }),
  z.object({
    boundaryType: z.literal("radius"),
    centerLat: z.number(),
    centerLng: z.number(),
    radiusKm: z.number().min(0.1).max(500),
  }),
]);

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
        boundary: boundaryInput.optional(),
        outsideBookingEnabled: z.boolean().optional(),
        outsideFeeType: z.enum(["flat", "per_km"]).optional(),
        outsideTerritoryFee: z.number().min(0).nullable().optional(),
        outsidePerKmRate: z.number().min(0).nullable().optional(),
        outsideFeeBaseKm: z.number().min(0).nullable().optional(),
        outsideMaxKm: z.number().min(0).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { boundary, outsideBookingEnabled, outsideFeeType, outsideTerritoryFee, outsidePerKmRate, outsideFeeBaseKm, outsideMaxKm, ...rest } = input;
      const boundaryData = getBoundaryData(boundary);
      return ctx.prisma.serviceTerritory.create({
        data: {
          workspaceId: ctx.workspace.id,
          ...rest,
          ...boundaryData,
          ...(outsideBookingEnabled !== undefined ? { outsideBookingEnabled } : {}),
          ...(outsideFeeType !== undefined ? { outsideFeeType } : {}),
          ...(outsideTerritoryFee !== undefined ? { outsideTerritoryFee } : {}),
          ...(outsidePerKmRate !== undefined ? { outsidePerKmRate } : {}),
          ...(outsideFeeBaseKm !== undefined ? { outsideFeeBaseKm } : {}),
          ...(outsideMaxKm !== undefined ? { outsideMaxKm } : {}),
        } as any,
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
        boundary: boundaryInput.optional(),
        outsideBookingEnabled: z.boolean().optional(),
        outsideFeeType: z.enum(["flat", "per_km"]).optional(),
        outsideTerritoryFee: z.number().min(0).nullable().optional(),
        outsidePerKmRate: z.number().min(0).nullable().optional(),
        outsideFeeBaseKm: z.number().min(0).nullable().optional(),
        outsideMaxKm: z.number().min(0).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const territory = await ctx.prisma.serviceTerritory.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!territory) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, boundary, outsideBookingEnabled, outsideFeeType, outsideTerritoryFee, outsidePerKmRate, outsideFeeBaseKm, outsideMaxKm, ...rest } = input;
      const boundaryData = getBoundaryData(boundary);
      return ctx.prisma.serviceTerritory.update({
        where: { id },
        data: {
          ...rest,
          ...boundaryData,
          ...(outsideBookingEnabled !== undefined ? { outsideBookingEnabled } : {}),
          ...(outsideFeeType !== undefined ? { outsideFeeType } : {}),
          ...(outsideTerritoryFee !== undefined ? { outsideTerritoryFee } : {}),
          ...(outsidePerKmRate !== undefined ? { outsidePerKmRate } : {}),
          ...(outsideFeeBaseKm !== undefined ? { outsideFeeBaseKm } : {}),
          ...(outsideMaxKm !== undefined ? { outsideMaxKm } : {}),
        } as any,
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

  // ── Kept for backwards compat — reads workspace-level settings ──
  getOutsideSettings: workspaceProcedure.query(async ({ ctx }) => {
    const ws = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      select: {
        outsideBookingEnabled: true,
        outsideFeeType: true,
        outsideTerritoryFee: true,
        outsidePerKmRate: true,
        outsideFeeBaseKm: true,
      },
    });
    return {
      outsideBookingEnabled: ws?.outsideBookingEnabled ?? true,
      outsideFeeType: (ws?.outsideFeeType as "flat" | "per_km") ?? "flat",
      outsideTerritoryFee: ws?.outsideTerritoryFee ?? null,
      outsidePerKmRate: ws?.outsidePerKmRate ?? null,
      outsideFeeBaseKm: ws?.outsideFeeBaseKm ?? null,
    };
  }),

  saveOutsideSettings: workspaceProcedure
    .input(
      z.object({
        outsideBookingEnabled: z.boolean(),
        outsideFeeType: z.enum(["flat", "per_km"]),
        outsideTerritoryFee: z.number().min(0).nullable(),
        outsidePerKmRate: z.number().min(0).nullable(),
        outsideFeeBaseKm: z.number().min(0).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workspace.update({
        where: { id: ctx.workspace.id },
        data: {
          outsideBookingEnabled: input.outsideBookingEnabled,
          outsideFeeType: input.outsideFeeType,
          outsideTerritoryFee: input.outsideTerritoryFee,
          outsidePerKmRate: input.outsidePerKmRate,
          outsideFeeBaseKm: input.outsideFeeBaseKm,
        },
        select: { outsideBookingEnabled: true },
      });
    }),

  // ── Public: detect territory for a booking address ─────────
  // Overlapping territories → pick lowest travel fee.
  // Outside all territories → use the nearest territory's outside settings.
  detectTerritory: publicProcedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        lat: z.number().optional(), // optional — omit for city-only (manual address entry)
        lng: z.number().optional(),
        territoryIds: z.array(z.string()).optional(), // restrict detection to these territories (from order form)
        city: z.string().optional(), // city name — used as fallback or primary when no coords
      })
    )
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { slug: input.workspaceSlug },
        select: {
          id: true,
          // Fallback workspace-level settings
          outsideBookingEnabled: true,
          outsideFeeType: true,
          outsideTerritoryFee: true,
          outsidePerKmRate: true,
          outsideFeeBaseKm: true,
        },
      });
      if (!workspace) {
        return { territory: null, outside: null };
      }

      const allTerritories = await ctx.prisma.serviceTerritory.findMany({
        where: { workspaceId: workspace.id },
      });

      // If order form has linked territories, only check those; otherwise check all
      const territories = input.territoryIds && input.territoryIds.length > 0
        ? allTerritories.filter((t) => input.territoryIds!.includes(t.id))
        : allTerritories;

      // Collect ALL matching territories
      const matches: { id: string; name: string; travelFee: number | null; color: string }[] = [];
      let nearestBoundaryDistKm = Infinity;
      let nearestTerritory: (typeof territories)[number] | null = null;

      // Only run geo-boundary check when coordinates are available
      const hasCoords = input.lat != null && input.lng != null;

      for (const t of territories) {
        let isInside = false;

        if (!hasCoords) {
          // Skip geo-boundary check — city-only matching handled below
        } else if (t.boundaryType === "polygon" && t.polygonCoords) {
          const coords = t.polygonCoords as [number, number][];
          isInside = pointInPolygon(input.lng!, input.lat!, coords);
          if (!isInside) {
            const dist = distanceToPolygonKm(input.lat!, input.lng!, coords);
            if (dist < nearestBoundaryDistKm) {
              nearestBoundaryDistKm = dist;
              nearestTerritory = t;
            }
          }
        } else if (
          t.boundaryType === "radius" &&
          t.centerLat != null &&
          t.centerLng != null &&
          t.radiusKm != null
        ) {
          const dist = haversineKm(input.lat!, input.lng!, t.centerLat, t.centerLng);
          isInside = dist <= t.radiusKm;
          if (!isInside) {
            const beyondEdge = dist - t.radiusKm;
            if (beyondEdge < nearestBoundaryDistKm) {
              nearestBoundaryDistKm = beyondEdge;
              nearestTerritory = t;
            }
          }
        }

        if (isInside) {
          matches.push({
            id: t.id,
            name: t.name,
            travelFee: t.travelFee,
            color: t.color,
          });
        }
      }

      // Inside a territory — pick lowest fee
      if (matches.length > 0) {
        matches.sort((a, b) => (a.travelFee ?? 0) - (b.travelFee ?? 0));
        return { territory: matches[0], outside: null };
      }

      // No geo-boundary match — fall back to city name matching against territory's cities list
      if (input.city) {
        const cityLower = input.city.trim().toLowerCase();
        for (const t of territories) {
          const citiesList = (t.cities ?? "")
            .split(",")
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean);
          const cityMatch = citiesList.some(
            (c) => c.includes(cityLower) || cityLower.includes(c)
          );
          if (cityMatch) {
            return {
              territory: { id: t.id, name: t.name, travelFee: t.travelFee, color: t.color },
              outside: null,
            };
          }
        }
      }

      // If no coordinates, we can't determine outside status — just return no match
      if (!hasCoords) {
        return { territory: null, outside: null };
      }

      // Outside all territories
      const hasBoundaries = territories.some((t) => t.boundaryType !== "none");
      if (!hasBoundaries) {
        return { territory: null, outside: null };
      }

      const distKm = nearestBoundaryDistKm === Infinity ? 0 : Math.round(nearestBoundaryDistKm * 10) / 10;

      // Global max-km check: if ALL territories with a maxKm have been exceeded, block
      const territoriesWithMaxKm = territories.filter((t) => t.boundaryType !== "none" && (t as any).outsideMaxKm != null);
      const globalMaxExceeded = territoriesWithMaxKm.length > 0 && territoriesWithMaxKm.every((t) => {
        // Calculate this point's distance from each territory's boundary
        let distFromT = Infinity;
        if (t.boundaryType === "polygon" && t.polygonCoords) {
          const coords = t.polygonCoords as [number, number][];
          distFromT = distanceToPolygonKm(input.lat!, input.lng!, coords);
        } else if (t.boundaryType === "radius" && t.centerLat != null && t.centerLng != null && t.radiusKm != null) {
          distFromT = Math.max(0, haversineKm(input.lat!, input.lng!, t.centerLat, t.centerLng) - t.radiusKm);
        }
        return distFromT > ((t as any).outsideMaxKm ?? Infinity);
      });

      // Use nearest territory's outside settings, fall back to workspace settings
      const outsideEnabled = nearestTerritory
        ? (nearestTerritory as any).outsideBookingEnabled ?? workspace.outsideBookingEnabled
        : workspace.outsideBookingEnabled;
      const feeType = nearestTerritory
        ? ((nearestTerritory as any).outsideFeeType as "flat" | "per_km") ?? (workspace.outsideFeeType as "flat" | "per_km")
        : (workspace.outsideFeeType as "flat" | "per_km");
      const maxKm: number | null = nearestTerritory
        ? (nearestTerritory as any).outsideMaxKm ?? null
        : null;

      // Enforce max km limit — block if nearest territory's max exceeded OR all territories' max exceeded
      const beyondMaxKm = globalMaxExceeded || (maxKm != null && distKm > maxKm);

      let calculatedFee: number | null = null;
      if (feeType === "per_km") {
        const rate = (nearestTerritory ? (nearestTerritory as any).outsidePerKmRate : workspace.outsidePerKmRate) ?? 0;
        const baseKm = (nearestTerritory ? (nearestTerritory as any).outsideFeeBaseKm : workspace.outsideFeeBaseKm) ?? 0;
        const chargeableKm = Math.max(0, distKm - baseKm);
        calculatedFee = Math.round(chargeableKm * rate * 100) / 100;
      } else {
        calculatedFee = (nearestTerritory ? (nearestTerritory as any).outsideTerritoryFee : workspace.outsideTerritoryFee) ?? null;
      }

      return {
        territory: null,
        outside: {
          allowed: outsideEnabled && !beyondMaxKm,
          feeType,
          fee: calculatedFee,
          distanceKm: distKm,
          maxKm,
        },
      };
    }),
});

// ─── Helpers ────────────────────────────────────────────────

function getBoundaryData(boundary?: z.infer<typeof boundaryInput>) {
  if (!boundary) return {};

  if (boundary.boundaryType === "polygon") {
    return {
      boundaryType: "polygon" as const,
      polygonCoords: boundary.polygonCoords,
      centerLat: null,
      centerLng: null,
      radiusKm: null,
    };
  }
  if (boundary.boundaryType === "radius") {
    return {
      boundaryType: "radius" as const,
      centerLat: boundary.centerLat,
      centerLng: boundary.centerLng,
      radiusKm: boundary.radiusKm,
      polygonCoords: null,
    };
  }
  return {
    boundaryType: "none" as const,
    polygonCoords: null,
    centerLat: null,
    centerLng: null,
    radiusKm: null,
  };
}

/** Ray-casting point-in-polygon */
function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Haversine distance in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Minimum distance from a point to the nearest edge of a polygon (in km) */
function distanceToPolygonKm(lat: number, lng: number, polygon: [number, number][]): number {
  let minDist = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x1, y1] = polygon[j]; // lng, lat
    const [x2, y2] = polygon[i];
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((lng - x1) * dx + (lat - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const nearLng = x1 + t * dx;
    const nearLat = y1 + t * dy;
    const dist = haversineKm(lat, lng, nearLat, nearLng);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

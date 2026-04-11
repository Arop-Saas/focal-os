import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure, publicProcedure } from "../trpc";

const coordinatePair = z.tuple([z.number(), z.number()]); // [lng, lat]

const boundaryInput = z.discriminatedUnion("boundaryType", [
  z.object({ boundaryType: z.literal("none") }),
  z.object({
    boundaryType: z.literal("polygon"),
    polygonCoords: z.array(coordinatePair).min(3), // at least a triangle
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const boundaryData = getBoundaryData(input.boundary);
      return ctx.prisma.serviceTerritory.create({
        data: {
          workspaceId: ctx.workspace.id,
          name: input.name,
          color: input.color,
          description: input.description,
          cities: input.cities,
          travelFee: input.travelFee,
          ...boundaryData,
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
        boundary: boundaryInput.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const territory = await ctx.prisma.serviceTerritory.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!territory) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, boundary, ...rest } = input;
      const boundaryData = getBoundaryData(boundary);
      return ctx.prisma.serviceTerritory.update({
        where: { id },
        data: { ...rest, ...boundaryData },
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

  // Public endpoint: detect which territory a coordinate falls in
  detectTerritory: publicProcedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        lat: z.number(),
        lng: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { slug: input.workspaceSlug },
        select: { id: true },
      });
      if (!workspace) return { territory: null };

      const territories = await ctx.prisma.serviceTerritory.findMany({
        where: { workspaceId: workspace.id },
      });

      for (const t of territories) {
        if (t.boundaryType === "polygon" && t.polygonCoords) {
          const coords = t.polygonCoords as [number, number][];
          if (pointInPolygon(input.lng, input.lat, coords)) {
            return {
              territory: {
                id: t.id,
                name: t.name,
                travelFee: t.travelFee,
                color: t.color,
              },
            };
          }
        } else if (
          t.boundaryType === "radius" &&
          t.centerLat != null &&
          t.centerLng != null &&
          t.radiusKm != null
        ) {
          const dist = haversineKm(input.lat, input.lng, t.centerLat, t.centerLng);
          if (dist <= t.radiusKm) {
            return {
              territory: {
                id: t.id,
                name: t.name,
                travelFee: t.travelFee,
                color: t.color,
              },
            };
          }
        }
      }

      return { territory: null };
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

/** Ray-casting point-in-polygon (works for non-self-intersecting polygons) */
function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

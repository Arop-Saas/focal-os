import type { Prisma, PrismaClient, PropertyType } from "@prisma/client";

/**
 * Property record helpers. Properties are deduped per workspace on a
 * normalized address key so "one property, many orders" works without
 * fuzzy matching. Legacy jobs keep their inline property fields and link
 * lazily — never backfilled in bulk.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export function propertyDedupeKey(args: {
  address: string;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  const norm = (v?: string | null) =>
    (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return [norm(args.address), norm(args.unit), norm(args.city), norm(args.state), norm(args.zip)].join("|");
}

export interface PropertyInput {
  workspaceId: string;
  address: string;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  propertyType?: PropertyType;
  squareFootage?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  mlsNumber?: string | null;
  listingUrl?: string | null;
  accessNotes?: string | null;
}

/**
 * Find the workspace's Property for this address or create it. Existing
 * records absorb newly-known facts (fills blanks only — never overwrites
 * data already on the property).
 */
export async function findOrCreateProperty(db: Db, input: PropertyInput) {
  const dedupeKey = propertyDedupeKey(input);

  const existing = await db.property.findUnique({
    where: { workspaceId_dedupeKey: { workspaceId: input.workspaceId, dedupeKey } },
  });

  if (existing) {
    const fill: Record<string, unknown> = {};
    if (existing.lat == null && input.lat != null) fill.lat = input.lat;
    if (existing.lng == null && input.lng != null) fill.lng = input.lng;
    if (existing.squareFootage == null && input.squareFootage != null) fill.squareFootage = input.squareFootage;
    if (existing.bedrooms == null && input.bedrooms != null) fill.bedrooms = input.bedrooms;
    if (existing.bathrooms == null && input.bathrooms != null) fill.bathrooms = input.bathrooms;
    if (!existing.mlsNumber && input.mlsNumber) fill.mlsNumber = input.mlsNumber;
    if (!existing.listingUrl && input.listingUrl) fill.listingUrl = input.listingUrl;
    if (!existing.accessNotes && input.accessNotes) fill.accessNotes = input.accessNotes;
    if (Object.keys(fill).length > 0) {
      return db.property.update({ where: { id: existing.id }, data: fill });
    }
    return existing;
  }

  return db.property.create({
    data: {
      workspaceId: input.workspaceId,
      address: input.address,
      unit: input.unit ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip: input.zip ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      propertyType: input.propertyType ?? "RESIDENTIAL",
      squareFootage: input.squareFootage ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      mlsNumber: input.mlsNumber ?? null,
      listingUrl: input.listingUrl ?? null,
      accessNotes: input.accessNotes ?? null,
      dedupeKey,
    },
  });
}

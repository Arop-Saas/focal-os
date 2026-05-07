/**
 * Travel-time calculation using Mapbox Directions API.
 * (Replaces the former Google Distance Matrix implementation.)
 *
 * Design principles:
 * - Always pessimistic — add 15-min buffer to every estimate
 * - Cache frequent route pairs to reduce API cost
 * - Graceful fallback: if API fails, return a safe default (45 min)
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

/** Buffer minutes added on top of every Mapbox estimate */
export const TRAVEL_BUFFER_MINS = 15;

/** Fallback travel time used when API is unavailable */
const FALLBACK_TRAVEL_MINS = 45;

export interface TravelTimeResult {
  durationMins: number;              // Raw drive time from Mapbox API
  durationWithBufferMins: number;    // + TRAVEL_BUFFER_MINS
  distanceKm: number;
  source: "mapbox" | "fallback";
}

// ---------------------------------------------------------------------------
// Simple in-process cache (address pair → result, TTL 6 hours)
// For production this should be Redis (Upstash), but in-process is fine for MVP
// ---------------------------------------------------------------------------
interface CacheEntry {
  result: TravelTimeResult;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function cacheKey(origin: string, destination: string) {
  return `${origin.toLowerCase().trim()}|||${destination.toLowerCase().trim()}`;
}

// ---------------------------------------------------------------------------
// Geocode an address to [lng, lat] via Mapbox Geocoding
// ---------------------------------------------------------------------------
const geocodeCache = new Map<string, { lng: number; lat: number; expiresAt: number }>();

async function geocodeAddress(
  address: string
): Promise<{ lng: number; lat: number } | null> {
  const key = address.toLowerCase().trim();
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { lng: cached.lng, lat: cached.lat };
  }

  if (!MAPBOX_TOKEN) return null;

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`
    );
    url.searchParams.set("access_token", MAPBOX_TOKEN);
    url.searchParams.set("limit", "1");
    url.searchParams.set("types", "address,place");

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const center = data.features?.[0]?.center; // [lng, lat]
    if (!center) return null;

    const result = { lng: center[0], lat: center[1] };
    geocodeCache.set(key, { ...result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch {
    return null;
  }
}

/**
 * Get travel time between two addresses using Mapbox Directions API.
 * Returns duration including the 15-min pessimistic buffer.
 */
export async function getTravelTime(
  originAddress: string,
  destinationAddress: string
): Promise<TravelTimeResult> {
  // Return zero for same address
  if (
    originAddress.toLowerCase().trim() ===
    destinationAddress.toLowerCase().trim()
  ) {
    return {
      durationMins: 0,
      durationWithBufferMins: TRAVEL_BUFFER_MINS,
      distanceKm: 0,
      source: "mapbox",
    };
  }

  // Check cache
  const key = cacheKey(originAddress, destinationAddress);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // No token → fallback
  if (!MAPBOX_TOKEN) {
    return buildFallback();
  }

  try {
    // Geocode both addresses to coordinates
    const [originGeo, destGeo] = await Promise.all([
      geocodeAddress(originAddress),
      geocodeAddress(destinationAddress),
    ]);

    if (!originGeo || !destGeo) {
      console.warn("[travel-time] Could not geocode one or both addresses");
      return buildFallback();
    }

    // Call Mapbox Directions API
    const coordinates = `${originGeo.lng},${originGeo.lat};${destGeo.lng},${destGeo.lat}`;
    const url = new URL(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}`
    );
    url.searchParams.set("access_token", MAPBOX_TOKEN);
    url.searchParams.set("overview", "false");
    url.searchParams.set("annotations", "duration,distance");

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn("[travel-time] Mapbox Directions HTTP error:", res.status);
      return buildFallback();
    }

    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) {
      console.warn("[travel-time] No route found");
      return buildFallback();
    }

    const durationMins = Math.ceil(route.duration / 60); // duration is in seconds
    const distanceKm = Math.round((route.distance / 1000) * 10) / 10; // distance is in meters

    const result: TravelTimeResult = {
      durationMins,
      durationWithBufferMins: durationMins + TRAVEL_BUFFER_MINS,
      distanceKm,
      source: "mapbox",
    };

    // Store in cache
    cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });

    return result;
  } catch (err) {
    console.warn("[travel-time] Unexpected error:", err);
    return buildFallback();
  }
}

function buildFallback(): TravelTimeResult {
  return {
    durationMins: FALLBACK_TRAVEL_MINS,
    durationWithBufferMins: FALLBACK_TRAVEL_MINS + TRAVEL_BUFFER_MINS,
    distanceKm: 0,
    source: "fallback",
  };
}

/**
 * Batch travel time: get times from one origin to multiple destinations.
 * Uses parallel requests (Mapbox Directions doesn't support matrix natively
 * on the free tier, so we geocode + request individually with caching).
 */
export async function getTravelTimeBatch(
  originAddress: string,
  destinationAddresses: string[]
): Promise<TravelTimeResult[]> {
  if (destinationAddresses.length === 0) return [];
  if (!MAPBOX_TOKEN) {
    return destinationAddresses.map(() => buildFallback());
  }

  // Run all in parallel — most will be cached after first call
  const results = await Promise.all(
    destinationAddresses.map((dest) => getTravelTime(originAddress, dest))
  );

  return results;
}

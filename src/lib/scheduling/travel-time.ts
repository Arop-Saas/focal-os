/**
 * Travel-time calculation using Google Maps Distance Matrix API.
 *
 * Design principles (from product brief):
 * - Always pessimistic — add 15-min buffer to every estimate
 * - Cache frequent route pairs to reduce API cost
 * - Graceful fallback: if API fails, return a safe default (45 min)
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/** Buffer minutes added on top of every Google Maps estimate */
export const TRAVEL_BUFFER_MINS = 15;

/** Fallback travel time used when API is unavailable */
const FALLBACK_TRAVEL_MINS = 45;

export interface TravelTimeResult {
  durationMins: number;        // Raw drive time from Maps API
  durationWithBufferMins: number; // + TRAVEL_BUFFER_MINS
  distanceKm: number;
  source: "google_maps" | "fallback";
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

/**
 * Get travel time between two addresses.
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
      source: "google_maps",
    };
  }

  // Check cache
  const key = cacheKey(originAddress, destinationAddress);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // No API key configured → fallback
  if (!GOOGLE_MAPS_API_KEY) {
    return buildFallback();
  }

  try {
    const params = new URLSearchParams({
      origins: originAddress,
      destinations: destinationAddress,
      mode: "driving",
      departure_time: "now",
      traffic_model: "pessimistic", // Matches our design principle
      key: GOOGLE_MAPS_API_KEY,
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`,
      { next: { revalidate: 0 } } // Never cache at HTTP layer
    );

    if (!res.ok) {
      console.warn("[travel-time] Maps API HTTP error:", res.status);
      return buildFallback();
    }

    const data = await res.json();

    if (data.status !== "OK") {
      console.warn("[travel-time] Maps API status:", data.status);
      return buildFallback();
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      console.warn("[travel-time] Element status:", element?.status);
      return buildFallback();
    }

    // Prefer duration_in_traffic when available (requires departure_time)
    const rawSecs =
      element.duration_in_traffic?.value ?? element.duration?.value ?? 0;
    const durationMins = Math.ceil(rawSecs / 60);
    const distanceKm = Math.round((element.distance?.value ?? 0) / 100) / 10;

    const result: TravelTimeResult = {
      durationMins,
      durationWithBufferMins: durationMins + TRAVEL_BUFFER_MINS,
      distanceKm,
      source: "google_maps",
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
 * More efficient than calling getTravelTime() in a loop.
 */
export async function getTravelTimeBatch(
  originAddress: string,
  destinationAddresses: string[]
): Promise<TravelTimeResult[]> {
  if (destinationAddresses.length === 0) return [];
  if (!GOOGLE_MAPS_API_KEY) {
    return destinationAddresses.map(() => buildFallback());
  }

  // Check which destinations are already cached
  const results: (TravelTimeResult | null)[] = destinationAddresses.map(
    (dest) => {
      const key = cacheKey(originAddress, dest);
      const cached = cache.get(key);
      return cached && cached.expiresAt > Date.now() ? cached.result : null;
    }
  );

  const uncachedIndices = results
    .map((r, i) => (r === null ? i : -1))
    .filter((i) => i !== -1);

  if (uncachedIndices.length === 0) {
    return results as TravelTimeResult[];
  }

  const uncachedDests = uncachedIndices.map((i) => destinationAddresses[i]);

  try {
    const params = new URLSearchParams({
      origins: originAddress,
      destinations: uncachedDests.join("|"),
      mode: "driving",
      departure_time: "now",
      traffic_model: "pessimistic",
      key: GOOGLE_MAPS_API_KEY,
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) {
      uncachedIndices.forEach((i) => {
        results[i] = buildFallback();
      });
      return results as TravelTimeResult[];
    }

    const data = await res.json();

    if (data.status !== "OK") {
      uncachedIndices.forEach((i) => {
        results[i] = buildFallback();
      });
      return results as TravelTimeResult[];
    }

    uncachedIndices.forEach((origIdx, batchIdx) => {
      const element = data.rows?.[0]?.elements?.[batchIdx];
      if (!element || element.status !== "OK") {
        results[origIdx] = buildFallback();
        return;
      }

      const rawSecs =
        element.duration_in_traffic?.value ?? element.duration?.value ?? 0;
      const durationMins = Math.ceil(rawSecs / 60);
      const distanceKm =
        Math.round((element.distance?.value ?? 0) / 100) / 10;

      const result: TravelTimeResult = {
        durationMins,
        durationWithBufferMins: durationMins + TRAVEL_BUFFER_MINS,
        distanceKm,
        source: "google_maps",
      };

      const key = cacheKey(originAddress, destinationAddresses[origIdx]);
      cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      results[origIdx] = result;
    });
  } catch {
    uncachedIndices.forEach((i) => {
      results[i] = buildFallback();
    });
  }

  return results as TravelTimeResult[];
}

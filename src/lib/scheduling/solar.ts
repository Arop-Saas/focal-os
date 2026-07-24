/**
 * Solar time calculation (NOAA simplified algorithm) — zero-dependency.
 * Used for twilight scheduling: Real Twilight appointments are constrained
 * to the golden-hour window computed from the property's location and date.
 * Accuracy is within ~2 minutes, ample for shoot scheduling.
 */

const RAD = Math.PI / 180;

/** Julian day from a UTC date */
function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Sunset for the given calendar date at lat/lng, returned as a UTC Date.
 * `dateISO` is the wall date ("YYYY-MM-DD") at the property.
 */
export function sunsetUtc(dateISO: string, lat: number, lng: number): Date | null {
  const [y, m, d] = dateISO.split("-").map(Number);
  const noonUtcGuess = new Date(Date.UTC(y, m - 1, d, 12) - (lng / 15) * 3600 * 1000);

  // NOAA formulation uses west-positive longitude
  const lw = -lng;
  const J = julianDay(noonUtcGuess);
  const n = Math.round(J - 2451545.0009 - lw / 360);
  const Jstar = 2451545.0009 + lw / 360 + n;
  const M = (357.5291 + 0.98560028 * (Jstar - 2451545)) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const Jtransit = Jstar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const delta = Math.asin(Math.sin(lambda * RAD) * Math.sin(23.44 * RAD));

  const cosH =
    (Math.sin(-0.83 * RAD) - Math.sin(lat * RAD) * Math.sin(delta)) /
    (Math.cos(lat * RAD) * Math.cos(delta));
  if (cosH < -1 || cosH > 1) return null; // polar day/night — no sunset

  const H = Math.acos(cosH) / RAD;
  const Jset = Jtransit + H / 360;
  return new Date((Jset - 2440587.5) * 86400000);
}

export interface TwilightWindow {
  /** suggested start: golden hour beginning (sunset − 40 min) */
  suggestedStart: Date;
  /** window opens (earliest sensible start) */
  windowStart: Date;
  /** window closes (civil dusk ≈ sunset + 25 min) */
  windowEnd: Date;
  sunset: Date;
}

/**
 * The bookable twilight window for a property on a date.
 * Golden hour ≈ 40 min before sunset; civil dusk ≈ 25 min after.
 */
export function twilightWindow(dateISO: string, lat: number, lng: number): TwilightWindow | null {
  const sunset = sunsetUtc(dateISO, lat, lng);
  if (!sunset) return null;
  return {
    suggestedStart: new Date(sunset.getTime() - 40 * 60000),
    windowStart: new Date(sunset.getTime() - 60 * 60000),
    windowEnd: new Date(sunset.getTime() + 25 * 60000),
    sunset,
  };
}

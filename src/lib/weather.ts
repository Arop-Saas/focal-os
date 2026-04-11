/**
 * Weather forecast via Open-Meteo API (free, no API key needed).
 * Returns a 7-day daily forecast for a given lat/lng.
 *
 * WMO weather codes → icon/label mapping included.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DayForecast {
  date: string;                // "2025-03-15"
  tempHighF: number;           // Fahrenheit
  tempLowF: number;
  weatherCode: number;         // WMO code
  icon: string;                // Emoji icon
  label: string;               // "Sunny", "Rain", etc.
  precipProbability: number;   // 0-100
  windSpeedMph: number;
}

export interface WeatherResult {
  daily: DayForecast[];
  source: "open-meteo" | "fallback";
}

// ---------------------------------------------------------------------------
// WMO Weather Code Mapping
// https://open-meteo.com/en/docs#api_form → WMO Weather interpretation codes
// ---------------------------------------------------------------------------

const WMO_CODES: Record<number, { icon: string; label: string }> = {
  0:  { icon: "☀️", label: "Clear sky" },
  1:  { icon: "🌤️", label: "Mainly clear" },
  2:  { icon: "⛅", label: "Partly cloudy" },
  3:  { icon: "☁️", label: "Overcast" },
  45: { icon: "🌫️", label: "Fog" },
  48: { icon: "🌫️", label: "Rime fog" },
  51: { icon: "🌦️", label: "Light drizzle" },
  53: { icon: "🌦️", label: "Drizzle" },
  55: { icon: "🌧️", label: "Heavy drizzle" },
  56: { icon: "🌧️", label: "Freezing drizzle" },
  57: { icon: "🌧️", label: "Heavy freezing drizzle" },
  61: { icon: "🌧️", label: "Light rain" },
  63: { icon: "🌧️", label: "Rain" },
  65: { icon: "🌧️", label: "Heavy rain" },
  66: { icon: "🌧️", label: "Freezing rain" },
  67: { icon: "🌧️", label: "Heavy freezing rain" },
  71: { icon: "🌨️", label: "Light snow" },
  73: { icon: "🌨️", label: "Snow" },
  75: { icon: "❄️", label: "Heavy snow" },
  77: { icon: "🌨️", label: "Snow grains" },
  80: { icon: "🌦️", label: "Light showers" },
  81: { icon: "🌧️", label: "Showers" },
  82: { icon: "⛈️", label: "Heavy showers" },
  85: { icon: "🌨️", label: "Light snow showers" },
  86: { icon: "❄️", label: "Heavy snow showers" },
  95: { icon: "⛈️", label: "Thunderstorm" },
  96: { icon: "⛈️", label: "Thunderstorm + hail" },
  99: { icon: "⛈️", label: "Thunderstorm + heavy hail" },
};

function decodeWMO(code: number): { icon: string; label: string } {
  return WMO_CODES[code] ?? { icon: "❓", label: "Unknown" };
}

function celsiusToFahrenheit(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371);
}

// ---------------------------------------------------------------------------
// Cache (coord-based, TTL 3 hours)
// ---------------------------------------------------------------------------
interface CacheEntry {
  result: WeatherResult;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

function cacheKey(lat: number, lng: number): string {
  // Round to ~1km precision to improve cache hits
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a 7-day weather forecast for a location.
 * Returns daily highs/lows, weather conditions, precipitation probability, and wind speed.
 */
export async function getWeatherForecast(
  lat: number,
  lng: number
): Promise<WeatherResult> {
  const key = cacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toFixed(4));
    url.searchParams.set("longitude", lng.toFixed(4));
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max");
    url.searchParams.set("temperature_unit", "celsius");
    url.searchParams.set("wind_speed_unit", "kmh");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "7");

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.warn("[weather] Open-Meteo HTTP error:", res.status);
      return buildFallback();
    }

    const data = await res.json();
    const d = data.daily;
    if (!d || !d.time?.length) {
      return buildFallback();
    }

    const daily: DayForecast[] = d.time.map((date: string, i: number) => {
      const wmo = decodeWMO(d.weather_code?.[i] ?? 0);
      return {
        date,
        tempHighF: celsiusToFahrenheit(d.temperature_2m_max?.[i] ?? 0),
        tempLowF: celsiusToFahrenheit(d.temperature_2m_min?.[i] ?? 0),
        weatherCode: d.weather_code?.[i] ?? 0,
        icon: wmo.icon,
        label: wmo.label,
        precipProbability: d.precipitation_probability_max?.[i] ?? 0,
        windSpeedMph: kmhToMph(d.wind_speed_10m_max?.[i] ?? 0),
      };
    });

    const result: WeatherResult = { daily, source: "open-meteo" };
    cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.warn("[weather] Unexpected error:", err);
    return buildFallback();
  }
}

function buildFallback(): WeatherResult {
  return { daily: [], source: "fallback" };
}

/**
 * Get weather for a specific date from the forecast.
 * Returns null if the date is outside the forecast window.
 */
export function getWeatherForDate(
  forecast: WeatherResult,
  dateStr: string // "2025-03-15" format
): DayForecast | null {
  return forecast.daily.find((d) => d.date === dateStr) ?? null;
}

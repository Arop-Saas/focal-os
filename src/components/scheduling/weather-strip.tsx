"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DayForecast {
  date: string;
  tempHighF: number;
  tempLowF: number;
  icon: string;
  label: string;
  precipProbability: number;
  windSpeedMph: number;
}

interface WeatherStripProps {
  /** Lat/lng to fetch weather for (e.g. workspace city or first job) */
  lat: number;
  lng: number;
  className?: string;
}

/**
 * A compact 7-day weather forecast strip for the scheduling calendar.
 * Fetches from Open-Meteo via our tRPC endpoint.
 */
export function WeatherStrip({ lat, lng, className }: WeatherStripProps) {
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      try {
        const res = await fetch(
          `/api/trpc/weather.getForecast?input=${encodeURIComponent(JSON.stringify({ lat, lng }))}`
        );
        const json = await res.json();
        const data = json?.result?.data;
        if (!cancelled && data?.daily) {
          setForecast(data.daily);
        }
      } catch {
        // Silently fail — weather is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWeather();
    return () => { cancelled = true; };
  }, [lat, lng]);

  if (loading || forecast.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto", className)}>
      {forecast.map((day) => {
        const dayLabel = format(new Date(day.date + "T12:00:00"), "EEE");
        const isToday = day.date === format(new Date(), "yyyy-MM-dd");

        return (
          <div
            key={day.date}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg min-w-[56px] transition-colors",
              isToday ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
            )}
            title={`${day.label} · High ${day.tempHighF}°F / Low ${day.tempLowF}°F · ${day.precipProbability}% rain · Wind ${day.windSpeedMph}mph`}
          >
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-wide",
              isToday ? "text-blue-600" : "text-gray-400"
            )}>
              {isToday ? "Today" : dayLabel}
            </span>
            <span className="text-lg leading-none">{day.icon}</span>
            <div className="flex items-center gap-1 text-[10px] tabular-nums">
              <span className="font-bold text-gray-700">{day.tempHighF}°</span>
              <span className="text-gray-400">{day.tempLowF}°</span>
            </div>
            {day.precipProbability > 20 && (
              <span className="text-[9px] text-blue-500 font-medium">
                {day.precipProbability}%💧
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Inline weather badge for a specific date — used in month grid cells and job cards.
 */
export function WeatherBadge({
  forecast,
  date,
}: {
  forecast: DayForecast[];
  date: string; // "yyyy-MM-dd"
}) {
  const day = forecast.find((d) => d.date === date);
  if (!day) return null;

  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] text-gray-400"
      title={`${day.label} · ${day.tempHighF}°/${day.tempLowF}° · ${day.precipProbability}% rain`}
    >
      <span>{day.icon}</span>
      <span className="font-medium text-gray-500">{day.tempHighF}°</span>
    </span>
  );
}

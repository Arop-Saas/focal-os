"use client";

import { useEffect, useState } from "react";
import { CloudSun, Droplets, Wind } from "lucide-react";

interface DayForecast {
  date: string;
  tempHighF: number;
  tempLowF: number;
  icon: string;
  label: string;
  precipProbability: number;
  windSpeedMph: number;
}

interface JobWeatherCardProps {
  lat: number;
  lng: number;
  scheduledDate: string; // "yyyy-MM-dd"
}

/**
 * Shows weather forecast for the job's scheduled date & location.
 * Uses Open-Meteo (free, no key). Only shows if date is within 7-day forecast window.
 */
export function JobWeatherCard({ lat, lng, scheduledDate }: JobWeatherCardProps) {
  const [weather, setWeather] = useState<DayForecast | null>(null);
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
          const dayWeather = data.daily.find((d: DayForecast) => d.date === scheduledDate);
          setWeather(dayWeather ?? null);
        }
      } catch {
        // Weather is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWeather();
    return () => { cancelled = true; };
  }, [lat, lng, scheduledDate]);

  if (loading || !weather) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl border border-blue-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <CloudSun className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-800">Weather Forecast</h3>
      </div>

      <div className="flex items-center gap-4">
        {/* Big icon + temp */}
        <div className="flex items-center gap-2">
          <span className="text-3xl">{weather.icon}</span>
          <div>
            <div className="text-lg font-bold text-gray-900">{weather.tempHighF}°F</div>
            <div className="text-xs text-gray-500">Low {weather.tempLowF}°F</div>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 space-y-1.5">
          <p className="text-sm font-medium text-gray-700">{weather.label}</p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Droplets className="h-3 w-3 text-blue-400" />
              {weather.precipProbability}% rain
            </span>
            <span className="flex items-center gap-1">
              <Wind className="h-3 w-3 text-gray-400" />
              {weather.windSpeedMph} mph
            </span>
          </div>
        </div>
      </div>

      {weather.precipProbability >= 50 && (
        <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700 font-medium">
            High chance of rain — consider rescheduling outdoor shoots.
          </p>
        </div>
      )}

      {weather.windSpeedMph >= 25 && (
        <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700 font-medium">
            High winds — drone photography may be affected.
          </p>
        </div>
      )}
    </div>
  );
}

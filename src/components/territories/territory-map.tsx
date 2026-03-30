"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, AlertCircle } from "lucide-react";

interface Territory {
  id: string;
  name: string;
  color: string;
  cities: string | null;
  travelFee: number | null;
}

interface TerritoryMapProps {
  territories: Territory[];
}

interface GeoResult {
  lat: number;
  lng: number;
  city: string;
  territory: Territory;
}

// Lightweight geocoding via Nominatim (free, no key required)
async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city.trim())}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (_) {
    // ignore network errors
  }
  return null;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
    _leafletLoaded?: boolean;
  }
}

async function loadLeaflet(): Promise<void> {
  if (window._leafletLoaded) return;

  // Inject CSS
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  // Inject JS
  await new Promise<void>((resolve, reject) => {
    if (window.L) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  window._leafletLoaded = true;
}

export function TerritoryMap({ territories }: TerritoryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [pointCount, setPointCount] = useState(0);

  useEffect(() => {
    if (territories.length === 0) return;
    let cancelled = false;

    async function init() {
      setStatus("loading");
      try {
        await loadLeaflet();
        if (cancelled || !mapRef.current) return;

        const L = window.L;

        // Destroy previous instance
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = L.map(mapRef.current, { zoomControl: true });
        mapInstanceRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(map);

        // Collect all cities to geocode
        const promises: Promise<GeoResult | null>[] = [];
        for (const territory of territories) {
          const cities = (territory.cities ?? "")
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
          for (const city of cities) {
            promises.push(
              geocodeCity(city).then((geo) =>
                geo ? { lat: geo.lat, lng: geo.lng, city, territory } : null
              )
            );
          }
        }

        const results = (await Promise.all(promises)).filter(
          (r): r is GeoResult => r !== null && !cancelled
        );

        if (cancelled) return;
        setPointCount(results.length);

        if (results.length === 0) {
          // Fallback: world view
          map.setView([20, 0], 2);
          setStatus("ready");
          return;
        }

        const bounds: [number, number][] = [];

        for (const r of results) {
          bounds.push([r.lat, r.lng]);

          // Build a custom SVG marker in the territory's color
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${r.territory.color}" stroke="white" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
          </svg>`;

          const icon = L.divIcon({
            html: svg,
            iconSize: [24, 36],
            iconAnchor: [12, 36],
            popupAnchor: [0, -36],
            className: "",
          });

          const feeLabel = r.territory.travelFee
            ? `<br/><span style="color:#d97706;font-size:11px;">+$${r.territory.travelFee.toFixed(2)} travel fee</span>`
            : "";

          L.marker([r.lat, r.lng], { icon })
            .addTo(map)
            .bindPopup(
              `<div style="font-size:13px;line-height:1.5;">
                <strong style="color:${r.territory.color}">${r.territory.name}</strong><br/>
                <span style="color:#6b7280">${r.city}</span>${feeLabel}
              </div>`,
              { maxWidth: 200 }
            );
        }

        // Fit map to all markers with some padding
        if (bounds.length === 1) {
          map.setView(bounds[0], 10);
        } else {
          map.fitBounds(bounds, { padding: [40, 40] });
        }

        setStatus("ready");
      } catch (_) {
        if (!cancelled) setStatus("error");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territories.map((t) => `${t.id}-${t.cities}-${t.color}`).join("|")]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (territories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MapPin className="w-8 h-8 text-gray-200 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No territories to show on the map.</p>
        <p className="text-xs text-gray-300 mt-1">Add territories with cities to see them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Territory legend */}
      <div className="flex flex-wrap gap-2">
        {territories.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium"
            style={{
              borderColor: t.color + "66",
              backgroundColor: t.color + "11",
              color: t.color,
            }}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: t.color }}
            />
            {t.name}
            {t.travelFee ? ` · +$${t.travelFee.toFixed(0)}` : ""}
          </div>
        ))}
      </div>

      {/* Map container */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height: 420 }}>
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />

        {/* Loading overlay */}
        {status === "loading" && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-xs text-gray-500">Geocoding cities…</p>
          </div>
        )}

        {/* Error overlay */}
        {status === "error" && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2 z-10">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-sm text-gray-500">Could not load the map.</p>
          </div>
        )}
      </div>

      {status === "ready" && pointCount > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Showing {pointCount} location{pointCount !== 1 ? "s" : ""} across {territories.length} territory area{territories.length !== 1 ? "s" : ""}.
          Click any pin for details.
        </p>
      )}
    </div>
  );
}

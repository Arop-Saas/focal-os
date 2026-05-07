"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, MapPin } from "lucide-react";
import { format } from "date-fns";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";

interface MapJob {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyLat?: number | null;
  propertyLng?: number | null;
  scheduledAt: Date;
  estimatedDurationMins: number;
  status: string;
  client: { firstName: string; lastName: string };
  package?: { name: string } | null;
}

// Status → marker color
const STATUS_COLORS: Record<string, string> = {
  PENDING: "#eab308",
  CONFIRMED: "#3b82f6",
  ASSIGNED: "#6366f1",
  IN_PROGRESS: "#22c55e",
  EDITING: "#a855f7",
  REVIEW: "#f97316",
  DELIVERED: "#14b8a6",
  COMPLETED: "#6b7280",
};

// ---------------------------------------------------------------------------
// Mapbox GL loader (shared with territory-map)
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    mapboxgl: any;
    _mapboxGLLoaded?: boolean;
  }
}

async function loadMapboxGL(): Promise<any> {
  if (window._mapboxGLLoaded && window.mapboxgl) return window.mapboxgl;

  if (!document.getElementById("mapbox-gl-css")) {
    const link = document.createElement("link");
    link.id = "mapbox-gl-css";
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css";
    document.head.appendChild(link);
  }

  await new Promise<void>((resolve, reject) => {
    if (window.mapboxgl) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  window._mapboxGLLoaded = true;
  return window.mapboxgl;
}

interface JobsMapViewProps {
  jobs: MapJob[];
  onJobClick?: (job: MapJob) => void;
}

export function JobsMapView({ jobs, onJobClick }: JobsMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Filter jobs that have coordinates
  const geoJobs = jobs.filter((j) => j.propertyLat && j.propertyLng);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus("loading");
      try {
        const mapboxgl = await loadMapboxGL();
        if (cancelled || !mapRef.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

        // Clean up previous
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = new mapboxgl.Map({
          container: mapRef.current,
          style: MAPBOX_STYLE,
          center: [-98.5795, 39.8283],
          zoom: 4,
          attributionControl: false,
        });

        mapInstanceRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          if (cancelled) return;

          if (geoJobs.length === 0) {
            setStatus("ready");
            return;
          }

          const bounds = new mapboxgl.LngLatBounds();

          for (const job of geoJobs) {
            const lng = job.propertyLng!;
            const lat = job.propertyLat!;
            bounds.extend([lng, lat]);

            const color = STATUS_COLORS[job.status] ?? "#6b7280";
            const time = format(new Date(job.scheduledAt), "h:mma");
            const dateStr = format(new Date(job.scheduledAt), "MMM d");

            // SVG pin marker
            const el = document.createElement("div");
            el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="40">
              <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
            </svg>`;
            el.style.cursor = "pointer";

            const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "260px" }).setHTML(
              `<div style="font-size:13px;line-height:1.6;font-family:system-ui,-apple-system,sans-serif;">
                <div style="font-weight:700;color:#111;margin-bottom:2px;">${job.client.firstName} ${job.client.lastName}</div>
                <div style="color:#6b7280;font-size:12px;">${job.propertyAddress}</div>
                <div style="color:#6b7280;font-size:12px;">${job.propertyCity}, ${job.propertyState}</div>
                <div style="margin-top:6px;display:flex;gap:8px;align-items:center;">
                  <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;background:${color}22;color:${color};border:1px solid ${color}44;">${job.status.replace(/_/g, " ")}</span>
                  <span style="font-size:12px;color:#374151;font-weight:600;">${time}</span>
                  <span style="font-size:11px;color:#9ca3af;">${dateStr}</span>
                </div>
                ${job.package ? `<div style="margin-top:4px;font-size:11px;color:#6b7280;">${job.package.name}</div>` : ""}
              </div>`
            );

            const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
              .setLngLat([lng, lat])
              .setPopup(popup)
              .addTo(map);

            // Click to select job
            el.addEventListener("click", () => {
              onJobClick?.(job);
            });

            markersRef.current.push(marker);
          }

          // Fit map to all markers
          if (geoJobs.length === 1) {
            map.flyTo({ center: [geoJobs[0].propertyLng!, geoJobs[0].propertyLat!], zoom: 13 });
          } else {
            map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
          }

          setStatus("ready");
        });
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoJobs.map((j) => j.id).join(",")]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Status legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div
            key={status}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: color + "15", color, border: `1px solid ${color}33` }}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {status.replace(/_/g, " ")}
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height: 600 }}>
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />

        {status === "loading" && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-xs text-gray-500">Loading map…</p>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2 z-10">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-sm text-gray-500">Could not load the map.</p>
          </div>
        )}
      </div>

      {/* Stats */}
      {status === "ready" && (
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>{geoJobs.length} job{geoJobs.length !== 1 ? "s" : ""} on map</span>
          {jobs.length - geoJobs.length > 0 && (
            <span className="text-amber-500">
              {jobs.length - geoJobs.length} job{jobs.length - geoJobs.length !== 1 ? "s" : ""} missing coordinates
            </span>
          )}
        </div>
      )}
    </div>
  );
}

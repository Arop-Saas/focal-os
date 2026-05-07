"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Marker {
  lat: number;
  lng: number;
  color?: string;
  popupHtml?: string;
}

interface MapboxMapProps {
  /** Center the map on these coordinates. If markers provided, auto-fits instead. */
  center?: { lat: number; lng: number };
  /** Default zoom level (0-22). Default: 14 */
  zoom?: number;
  /** Markers to display on the map */
  markers?: Marker[];
  /** Map container height in px. Default: 300 */
  height?: number;
  /** Extra CSS classes for the wrapper div */
  className?: string;
  /** Whether to show navigation controls. Default: true */
  showControls?: boolean;
  /** Whether the map should be interactive (scroll zoom, drag). Default: true */
  interactive?: boolean;
}

// ─── Mapbox GL loader ───────────────────────────────────────────────────────

declare global {
  interface Window {
    mapboxgl: any;
    _mapboxGLLoaded?: boolean;
  }
}

async function loadMapboxGL(): Promise<any> {
  if (window._mapboxGLLoaded && window.mapboxgl) return window.mapboxgl;

  // Inject CSS
  if (!document.getElementById("mapbox-gl-css")) {
    const link = document.createElement("link");
    link.id = "mapbox-gl-css";
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css";
    document.head.appendChild(link);
  }

  // Inject JS
  await new Promise<void>((resolve, reject) => {
    if (window.mapboxgl) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  window._mapboxGLLoaded = true;
  return window.mapboxgl;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MapboxMap({
  center,
  zoom = 14,
  markers = [],
  height = 300,
  className = "",
  showControls = true,
  interactive = true,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-token">("loading");

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setStatus("no-token");
      return;
    }

    let cancelled = false;

    async function init() {
      setStatus("loading");
      try {
        const mapboxgl = await loadMapboxGL();
        if (cancelled || !containerRef.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

        // Destroy previous instance
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        // Determine initial center
        const initCenter = center
          ? [center.lng, center.lat]
          : markers.length > 0
          ? [markers[0].lng, markers[0].lat]
          : [-98.5795, 39.8283]; // Center of USA

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: MAPBOX_STYLE,
          center: initCenter,
          zoom: markers.length > 1 ? 3 : zoom,
          interactive,
          attributionControl: false,
        });

        mapRef.current = map;

        if (showControls && interactive) {
          map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        }

        map.on("load", () => {
          if (cancelled) return;

          // Clear old markers
          markersRef.current.forEach((m) => m.remove());
          markersRef.current = [];

          // Add markers
          for (const m of markers) {
            const el = document.createElement("div");
            el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
              <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${m.color || "#3B82F6"}" stroke="white" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
            </svg>`;
            el.style.cursor = "pointer";

            const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
              .setLngLat([m.lng, m.lat])
              .addTo(map);

            if (m.popupHtml) {
              const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "220px" }).setHTML(m.popupHtml);
              marker.setPopup(popup);
            }

            markersRef.current.push(marker);
          }

          // Fit bounds if multiple markers
          if (markers.length > 1) {
            const bounds = new mapboxgl.LngLatBounds();
            markers.forEach((m) => bounds.extend([m.lng, m.lat]));
            map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
          }

          setStatus("ready");
        });
      } catch (err) {
        console.error("[MapboxMap] Error:", err);
        if (!cancelled) setStatus("error");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    center?.lat,
    center?.lng,
    zoom,
    interactive,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(markers.map((m) => `${m.lat},${m.lng},${m.color}`)),
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (status === "no-token") {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-400 ${className}`}
        style={{ height }}
      >
        Map not configured — add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden border border-gray-200 ${className}`} style={{ height }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />

      {status === "loading" && (
        <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2 z-10">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <p className="text-xs text-gray-500">Loading map…</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2 z-10">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-gray-500">Could not load the map.</p>
        </div>
      )}
    </div>
  );
}

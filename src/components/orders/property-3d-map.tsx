"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

// Window.mapboxgl / _mapboxGLLoaded are declared by shared/mapbox-map.tsx;
// this loader shares the same CDN singleton.
const w = () => window as unknown as { mapboxgl?: any; _mapboxGLLoaded?: boolean };

async function loadMapboxGL(): Promise<any> {
  if (w()._mapboxGLLoaded && w().mapboxgl) return w().mapboxgl;
  if (!document.getElementById("mapbox-gl-css")) {
    const link = document.createElement("link");
    link.id = "mapbox-gl-css";
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css";
    document.head.appendChild(link);
  }
  await new Promise<void>((resolve, reject) => {
    if (w().mapboxgl) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
  w()._mapboxGLLoaded = true;
  return w().mapboxgl;
}

/**
 * Tilted 3D property map (Mapbox Standard style renders 3D buildings and
 * terrain natively). Sits under Services & Billing on the order Overview.
 */
export function Property3DMap({ lat, lng, address }: { lat: number; lng: number; address: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!MAPBOX_TOKEN) { setStatus("error"); return; }
    let cancelled = false;

    async function init() {
      try {
        const mapboxgl = await loadMapboxGL();
        if (cancelled || !containerRef.current) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/standard",
          center: [lng, lat],
          zoom: 16.5,
          pitch: 58,
          bearing: -18,
          antialias: true,
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
        new mapboxgl.Marker({ color: "#2563EB" })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(
            `<div style="font-size:13px;font-weight:500;">${address}</div>`
          ))
          .addTo(map);
        map.on("load", () => { if (!cancelled) setStatus("ready"); });
        map.on("error", () => { if (!cancelled && status === "loading") setStatus("ready"); });
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    init();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  if (status === "error") return null;

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="relative" style={{ height: 280 }}>
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </section>
  );
}

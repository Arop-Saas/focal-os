"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { Loader2, AlertCircle, Map, Eye, EyeOff } from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";

// ─── Colors assigned per staff member ────────────────────

const STAFF_COLORS = [
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#6366F1", // indigo
  "#84CC16", // lime
];

// ─── Mapbox GL loader ─────────────────────────────────────

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

// ─── Geometry helpers ────────────────────────────────────

function createCircleGeoJSON(centerLng: number, centerLat: number, radiusKm: number) {
  const points = 64;
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusKm * Math.cos(angle);
    const dy = radiusKm * Math.sin(angle);
    const lat = centerLat + (dy / 6371) * (180 / Math.PI);
    const lng = centerLng + (dx / (6371 * Math.cos((centerLat * Math.PI) / 180))) * (180 / Math.PI);
    coords.push([lng, lat]);
  }
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [coords] },
    properties: {},
  };
}

// ─── Types ───────────────────────────────────────────────

interface StaffCoverageData {
  staffId: string;
  name: string;
  color: string;
  homeLat: number | null;
  homeLng: number | null;
  homeAddress: string | null;
  coverageBoundaryType: string;
  coveragePolygonCoords: [number, number][] | null;
  coverageCenterLat: number | null;
  coverageCenterLng: number | null;
  coverageRadiusKm: number | null;
}

// ─── Component ────────────────────────────────────────────

export function TeamCoverageMap() {
  const { data: memberData, isLoading } = trpc.staff.list.useQuery({});

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [hiddenStaff, setHiddenStaff] = useState<Set<string>>(new Set());

  // Parse staff data
  const staffCoverage: StaffCoverageData[] = (memberData ?? [])
    .filter((m: any) => m.staffProfile)
    .map((m: any, i: number) => {
      const p = m.staffProfile;
      return {
        staffId: p.id,
        name: m.user?.fullName ?? m.user?.email ?? "Staff",
        color: STAFF_COLORS[i % STAFF_COLORS.length],
        homeLat: p.homeLat ?? null,
        homeLng: p.homeLng ?? null,
        homeAddress: p.homeAddress ?? null,
        coverageBoundaryType: p.coverageBoundaryType ?? "none",
        coveragePolygonCoords: p.coveragePolygonCoords as [number, number][] | null,
        coverageCenterLat: p.coverageCenterLat ?? null,
        coverageCenterLng: p.coverageCenterLng ?? null,
        coverageRadiusKm: p.coverageRadiusKm ?? null,
      };
    });

  // Only show staff who have a home location or a coverage area
  const staffWithLocation = staffCoverage.filter(
    (s) => (s.homeLat != null && s.homeLng != null) || s.coverageBoundaryType !== "none"
  );

  function toggleStaffVisibility(staffId: string) {
    setHiddenStaff((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) {
        next.delete(staffId);
      } else {
        next.add(staffId);
      }
      return next;
    });
  }

  // ─── Render layers on map ──────────────────────────────

  const renderAllCoverage = useCallback((map: any, mapboxgl: any) => {
    // Remove old layers/sources
    staffCoverage.forEach((s) => {
      const fillId = `cov-fill-${s.staffId}`;
      const lineId = `cov-line-${s.staffId}`;
      const srcId = `cov-src-${s.staffId}`;
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getSource(srcId)) map.removeSource(srcId);
    });

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    for (const s of staffCoverage) {
      const isHidden = hiddenStaff.has(s.staffId);

      // Add home pin marker
      if (s.homeLat != null && s.homeLng != null && !isHidden) {
        bounds.extend([s.homeLng, s.homeLat]);
        hasBounds = true;

        const el = document.createElement("div");
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
          <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${s.color}" stroke="white" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
        </svg>`;
        el.style.cursor = "pointer";

        const addressLine = s.homeAddress
          ? `<br/><span style="color:#6b7280;font-size:11px;">${s.homeAddress.length > 60 ? s.homeAddress.slice(0, 60) + "…" : s.homeAddress}</span>`
          : "";
        const coverageLabel = s.coverageBoundaryType === "polygon"
          ? `<br/><span style="color:${s.color};font-size:11px;">Polygon coverage area</span>`
          : s.coverageBoundaryType === "radius"
          ? `<br/><span style="color:${s.color};font-size:11px;">${s.coverageRadiusKm?.toFixed(1)}km radius coverage</span>`
          : "";

        const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "240px" }).setHTML(
          `<div style="font-size:13px;line-height:1.5;">
            <strong style="color:${s.color}">${s.name}</strong>${addressLine}${coverageLabel}
          </div>`
        );

        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([s.homeLng, s.homeLat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      }

      // Add coverage boundary
      if (s.coverageBoundaryType !== "none" && !isHidden) {
        let geojson: any = null;

        if (s.coverageBoundaryType === "polygon" && s.coveragePolygonCoords && s.coveragePolygonCoords.length >= 3) {
          const ring = [...s.coveragePolygonCoords];
          if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
            ring.push(ring[0]);
          }
          geojson = { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} };
          s.coveragePolygonCoords.forEach((c) => { bounds.extend(c); hasBounds = true; });
        } else if (
          s.coverageBoundaryType === "radius" &&
          s.coverageCenterLat != null && s.coverageCenterLng != null && s.coverageRadiusKm != null
        ) {
          geojson = createCircleGeoJSON(s.coverageCenterLng, s.coverageCenterLat, s.coverageRadiusKm);
          bounds.extend([s.coverageCenterLng, s.coverageCenterLat]);
          hasBounds = true;
        }

        if (geojson) {
          const srcId = `cov-src-${s.staffId}`;
          map.addSource(srcId, { type: "geojson", data: geojson });
          map.addLayer({
            id: `cov-fill-${s.staffId}`,
            type: "fill",
            source: srcId,
            paint: { "fill-color": s.color, "fill-opacity": 0.15 },
          });
          map.addLayer({
            id: `cov-line-${s.staffId}`,
            type: "line",
            source: srcId,
            paint: { "line-color": s.color, "line-width": 2, "line-dasharray": [2, 2] },
          });
        }
      }
    }

    // Fit bounds
    if (hasBounds) {
      const visibleCount = staffWithLocation.filter((s) => !hiddenStaff.has(s.staffId)).length;
      if (visibleCount === 1) {
        const s = staffWithLocation.find((s) => !hiddenStaff.has(s.staffId));
        if (s?.homeLng != null && s?.homeLat != null) {
          map.flyTo({ center: [s.homeLng, s.homeLat], zoom: 11 });
        }
      } else {
        map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffCoverage.map((s) => `${s.staffId}-${s.coverageBoundaryType}-${s.homeLat}`).join("|"), hiddenStaff]);

  // ─── Init map ──────────────────────────────────────────

  useEffect(() => {
    if (isLoading || staffWithLocation.length === 0) return;
    let cancelled = false;

    async function init() {
      setMapStatus("loading");
      try {
        const mapboxgl = await loadMapboxGL();
        if (cancelled || !mapRef.current) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;

        // Destroy previous
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

        // Default center from first staff with location
        const first = staffWithLocation.find((s) => s.homeLat != null && s.homeLng != null);
        const map = new mapboxgl.Map({
          container: mapRef.current,
          style: MAPBOX_STYLE,
          center: first ? [first.homeLng!, first.homeLat!] : [-98.5795, 39.8283],
          zoom: first ? 10 : 3,
          attributionControl: false,
        });

        mapInstanceRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          if (cancelled) return;
          setMapStatus("ready");
          renderAllCoverage(map, mapboxgl);
        });
      } catch {
        if (!cancelled) setMapStatus("error");
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, staffWithLocation.length]);

  // Re-render when visibility toggles or data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || mapStatus !== "ready") return;
    try { renderAllCoverage(map, window.mapboxgl); } catch { /* map not ready */ }
  }, [hiddenStaff, renderAllCoverage, mapStatus]);

  // Cleanup
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  // ─── Render ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    );
  }

  if (staffWithLocation.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <Map className="h-5 w-5 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">No coverage areas set up yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Set home locations and draw coverage areas for your staff in the Home Location tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-3.5 h-3.5 text-blue-600" />
          <p className="text-xs font-semibold text-gray-700">Team Coverage Overview</p>
        </div>
        <p className="text-xs text-gray-400">
          {staffWithLocation.length} staff member{staffWithLocation.length !== 1 ? "s" : ""} with coverage areas
        </p>
      </div>

      {/* Staff legend / toggles */}
      <div className="flex flex-wrap gap-2">
        {staffWithLocation.map((s) => {
          const isHidden = hiddenStaff.has(s.staffId);
          return (
            <button
              key={s.staffId}
              type="button"
              onClick={() => toggleStaffVisibility(s.staffId)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                isHidden
                  ? "border-gray-200 text-gray-400 bg-gray-50 opacity-60"
                  : "border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
              }`}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: isHidden ? "#d1d5db" : s.color }}
              />
              <span>{s.name}</span>
              {isHidden ? (
                <EyeOff className="w-3 h-3 text-gray-400" />
              ) : (
                <Eye className="w-3 h-3 text-gray-400" />
              )}
              {!isHidden && s.coverageBoundaryType !== "none" && (
                <span className="text-[10px] text-gray-400">
                  {s.coverageBoundaryType === "polygon"
                    ? "polygon"
                    : `${s.coverageRadiusKm?.toFixed(0)}km`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height: 480 }}>
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />

        {mapStatus === "loading" && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center gap-2 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs text-gray-500">Loading map...</span>
          </div>
        )}
        {mapStatus === "error" && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center gap-2 z-10">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <span className="text-sm text-gray-500">Could not load the map.</span>
          </div>
        )}
      </div>

      {/* Summary */}
      {mapStatus === "ready" && (
        <p className="text-xs text-gray-400 text-center">
          Showing {staffWithLocation.filter((s) => !hiddenStaff.has(s.staffId)).length} of{" "}
          {staffWithLocation.length} staff coverage areas. Click a name above to toggle visibility.
        </p>
      )}
    </div>
  );
}

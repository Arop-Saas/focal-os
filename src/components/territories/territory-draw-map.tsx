"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle, Pencil, Circle, Trash2, MousePointer, Undo2 } from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";

type DrawMode = "none" | "polygon" | "radius";

export interface BoundaryData {
  boundaryType: "none" | "polygon" | "radius";
  polygonCoords?: [number, number][];
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

interface CityMarker {
  lat: number;
  lng: number;
  name: string;
}

interface TerritoryDrawMapProps {
  color: string;
  cityMarkers: CityMarker[];
  /** Existing boundary to display */
  initialBoundary?: BoundaryData | null;
  /** Called whenever the boundary changes */
  onBoundaryChange: (boundary: BoundaryData) => void;
}

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

// ─── Geometry helpers ─────────────────────────────────────

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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Component ────────────────────────────────────────────

export function TerritoryDrawMap({
  color,
  cityMarkers,
  initialBoundary,
  onBoundaryChange,
}: TerritoryDrawMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // Drawing state
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>(
    initialBoundary?.boundaryType === "polygon" && initialBoundary.polygonCoords
      ? initialBoundary.polygonCoords
      : []
  );
  const [radiusCenter, setRadiusCenter] = useState<[number, number] | null>(
    initialBoundary?.boundaryType === "radius" && initialBoundary.centerLng != null && initialBoundary.centerLat != null
      ? [initialBoundary.centerLng, initialBoundary.centerLat]
      : null
  );
  const [radiusKm, setRadiusKm] = useState<number>(initialBoundary?.radiusKm ?? 10);

  // Track whether a boundary has been set (either from initial or drawn)
  const hasBoundary =
    (polygonPoints.length >= 3 && drawMode === "none") ||
    (radiusCenter !== null && drawMode === "none") ||
    initialBoundary?.boundaryType !== "none" && initialBoundary?.boundaryType != null;

  // Refs for event handlers
  const drawModeRef = useRef(drawMode);
  const polygonPointsRef = useRef(polygonPoints);
  const radiusCenterRef = useRef(radiusCenter);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { polygonPointsRef.current = polygonPoints; }, [polygonPoints]);
  useEffect(() => { radiusCenterRef.current = radiusCenter; }, [radiusCenter]);

  const isDrawing = drawMode !== "none";

  // ─── Render drawing/boundary on map ────────────────────

  const renderOverlays = useCallback((map: any) => {
    // Clean previous
    const ids = ["draw-fill", "draw-line", "draw-pts", "boundary-fill", "boundary-line"];
    const srcs = ["draw-src", "draw-pts-src", "boundary-src"];
    ids.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
    srcs.forEach((id) => { if (map.getSource(id)) map.removeSource(id); });

    // Render saved/confirmed boundary
    if (drawMode === "none") {
      let geojson: any = null;
      if (polygonPoints.length >= 3) {
        const ring = [...polygonPoints, polygonPoints[0]];
        geojson = { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} };
      } else if (radiusCenter) {
        geojson = createCircleGeoJSON(radiusCenter[0], radiusCenter[1], radiusKm);
      }
      if (geojson) {
        map.addSource("boundary-src", { type: "geojson", data: geojson });
        map.addLayer({ id: "boundary-fill", type: "fill", source: "boundary-src", paint: { "fill-color": color, "fill-opacity": 0.2 } });
        map.addLayer({ id: "boundary-line", type: "line", source: "boundary-src", paint: { "line-color": color, "line-width": 2.5, "line-dasharray": [2, 2] } });
      }
      return;
    }

    // Render active drawing
    if (drawMode === "polygon" && polygonPoints.length >= 1) {
      if (polygonPoints.length >= 3) {
        const ring = [...polygonPoints, polygonPoints[0]];
        map.addSource("draw-src", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} } });
        map.addLayer({ id: "draw-fill", type: "fill", source: "draw-src", paint: { "fill-color": color, "fill-opacity": 0.25 } });
        map.addLayer({ id: "draw-line", type: "line", source: "draw-src", paint: { "line-color": color, "line-width": 2.5 } });
      } else if (polygonPoints.length === 2) {
        map.addSource("draw-src", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: polygonPoints }, properties: {} } });
        map.addLayer({ id: "draw-line", type: "line", source: "draw-src", paint: { "line-color": color, "line-width": 2.5 } });
      }
      // Vertex dots
      const pts = polygonPoints.map((p) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: p }, properties: {} }));
      map.addSource("draw-pts-src", { type: "geojson", data: { type: "FeatureCollection", features: pts } });
      map.addLayer({ id: "draw-pts", type: "circle", source: "draw-pts-src", paint: { "circle-radius": 5, "circle-color": color, "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });
    }

    if (drawMode === "radius" && radiusCenter) {
      const circle = createCircleGeoJSON(radiusCenter[0], radiusCenter[1], radiusKm);
      map.addSource("draw-src", { type: "geojson", data: circle });
      map.addLayer({ id: "draw-fill", type: "fill", source: "draw-src", paint: { "fill-color": color, "fill-opacity": 0.25 } });
      map.addLayer({ id: "draw-line", type: "line", source: "draw-src", paint: { "line-color": color, "line-width": 2.5 } });
      // Center dot
      map.addSource("draw-pts-src", { type: "geojson", data: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: radiusCenter }, properties: {} }] } });
      map.addLayer({ id: "draw-pts", type: "circle", source: "draw-pts-src", paint: { "circle-radius": 6, "circle-color": color, "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });
    }
  }, [drawMode, polygonPoints, radiusCenter, radiusKm, color]);

  // Re-render overlays when state changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || status !== "ready") return;
    try { renderOverlays(map); } catch { /* map not ready */ }
  }, [drawMode, polygonPoints, radiusCenter, radiusKm, color, renderOverlays, status]);

  // ─── Map init ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus("loading");
      try {
        const mapboxgl = await loadMapboxGL();
        if (cancelled || !mapRef.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

        // Destroy previous
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        // Determine initial center from city markers
        const defaultCenter: [number, number] = cityMarkers.length > 0
          ? [cityMarkers[0].lng, cityMarkers[0].lat]
          : [-98.5795, 39.8283];

        const map = new mapboxgl.Map({
          container: mapRef.current,
          style: MAPBOX_STYLE,
          center: defaultCenter,
          zoom: cityMarkers.length > 0 ? 9 : 3,
          attributionControl: false,
        });

        mapInstanceRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          if (cancelled) return;

          // Fit bounds to markers
          if (cityMarkers.length > 0) {
            const bounds = new mapboxgl.LngLatBounds();
            cityMarkers.forEach((m) => bounds.extend([m.lng, m.lat]));
            if (cityMarkers.length === 1) {
              map.flyTo({ center: [cityMarkers[0].lng, cityMarkers[0].lat], zoom: 10 });
            } else {
              map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
            }
          }

          // Add city markers
          for (const m of cityMarkers) {
            const el = document.createElement("div");
            el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="20" height="30">
              <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
            </svg>`;
            el.style.cursor = "pointer";

            const popup = new mapboxgl.Popup({ offset: 20, maxWidth: "160px" }).setHTML(
              `<div style="font-size:12px;font-weight:600;color:${color}">${m.name}</div>`
            );

            const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
              .setLngLat([m.lng, m.lat])
              .setPopup(popup)
              .addTo(map);

            markersRef.current.push(marker);
          }

          // Render initial boundary
          renderOverlays(map);
          setStatus("ready");
        });

        // Click handler for drawing
        map.on("click", (e: any) => {
          const mode = drawModeRef.current;
          if (mode === "none") return;
          const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          if (mode === "polygon") {
            setPolygonPoints((prev) => [...prev, lngLat]);
          } else if (mode === "radius" && !radiusCenterRef.current) {
            setRadiusCenter(lngLat);
            setRadiusKm(10);
          }
        });
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityMarkers.map((m) => `${m.lat},${m.lng}`).join("|")]);

  // Cleanup
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  // ─── Drawing actions ───────────────────────────────────

  function startPolygon() {
    setDrawMode("polygon");
    setPolygonPoints([]);
    setRadiusCenter(null);
    const map = mapInstanceRef.current;
    if (map) map.getCanvas().style.cursor = "crosshair";
  }

  function startRadius() {
    setDrawMode("radius");
    setRadiusCenter(null);
    setPolygonPoints([]);
    setRadiusKm(10);
    const map = mapInstanceRef.current;
    if (map) map.getCanvas().style.cursor = "crosshair";
  }

  function cancelDraw() {
    setDrawMode("none");
    // Restore previous boundary if it existed
    if (initialBoundary?.boundaryType === "polygon" && initialBoundary.polygonCoords) {
      setPolygonPoints(initialBoundary.polygonCoords);
      setRadiusCenter(null);
    } else if (initialBoundary?.boundaryType === "radius" && initialBoundary.centerLng != null && initialBoundary.centerLat != null) {
      setRadiusCenter([initialBoundary.centerLng, initialBoundary.centerLat]);
      setRadiusKm(initialBoundary.radiusKm ?? 10);
      setPolygonPoints([]);
    } else {
      setPolygonPoints([]);
      setRadiusCenter(null);
    }
    const map = mapInstanceRef.current;
    if (map) map.getCanvas().style.cursor = "";
  }

  function undoLastPoint() {
    setPolygonPoints((prev) => prev.slice(0, -1));
  }

  function confirmDraw() {
    const map = mapInstanceRef.current;
    if (map) map.getCanvas().style.cursor = "";

    if (drawMode === "polygon" && polygonPoints.length >= 3) {
      onBoundaryChange({ boundaryType: "polygon", polygonCoords: polygonPoints });
    } else if (drawMode === "radius" && radiusCenter) {
      onBoundaryChange({ boundaryType: "radius", centerLat: radiusCenter[1], centerLng: radiusCenter[0], radiusKm });
    }
    setDrawMode("none");
  }

  function clearBoundary() {
    setPolygonPoints([]);
    setRadiusCenter(null);
    setDrawMode("none");
    onBoundaryChange({ boundaryType: "none" });
    const map = mapInstanceRef.current;
    if (map) map.getCanvas().style.cursor = "";
  }

  // ─── Render ────────────────────────────────────────────

  const mapHeight = isDrawing ? 400 : 220;

  return (
    <div className="space-y-2">
      {/* Drawing toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {drawMode === "none" ? (
          <>
            <button type="button" onClick={startPolygon} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <Pencil className="w-3 h-3" /> Draw Polygon
            </button>
            <button type="button" onClick={startRadius} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <Circle className="w-3 h-3" /> Set Radius
            </button>
            {hasBoundary && (
              <button type="button" onClick={clearBoundary} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3 h-3" /> Clear Boundary
              </button>
            )}
          </>
        ) : drawMode === "polygon" ? (
          <>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-700">
              <MousePointer className="w-3 h-3" />
              Click to place points ({polygonPoints.length})
              {polygonPoints.length < 3 && " — need 3+"}
            </div>
            {polygonPoints.length > 0 && (
              <button type="button" onClick={undoLastPoint} className="flex items-center gap-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                <Undo2 className="w-3 h-3" /> Undo
              </button>
            )}
            {polygonPoints.length >= 3 && (
              <button type="button" onClick={confirmDraw} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                Confirm Shape
              </button>
            )}
            <button type="button" onClick={cancelDraw} className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </>
        ) : drawMode === "radius" ? (
          <>
            {!radiusCenter ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-700">
                <MousePointer className="w-3 h-3" /> Click map to place center
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Radius:</span>
                  <input type="range" min={0.5} max={100} step={0.5} value={radiusKm} onChange={(e) => setRadiusKm(parseFloat(e.target.value))} className="w-28 accent-blue-600" />
                  <span className="text-xs font-semibold text-gray-700 w-16">{radiusKm.toFixed(1)}km</span>
                  <span className="text-[11px] text-gray-400">({(radiusKm * 0.621371).toFixed(1)}mi)</span>
                </div>
                <button type="button" onClick={confirmDraw} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                  Confirm
                </button>
              </>
            )}
            <button type="button" onClick={cancelDraw} className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </>
        ) : null}
      </div>

      {/* Map */}
      <div
        className="relative rounded-xl overflow-hidden border border-gray-200 transition-all duration-300"
        style={{ height: mapHeight }}
      >
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />

        {status === "loading" && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center gap-2 z-10">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-xs text-gray-500">Loading map…</span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center gap-2 z-10">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-gray-500">Could not load map</span>
          </div>
        )}

        {/* Drawing mode badge */}
        {isDrawing && status === "ready" && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded-full text-[11px] font-medium shadow-lg">
            <MousePointer className="w-3 h-3" />
            {drawMode === "polygon" ? "Drawing polygon" : "Setting radius"}
          </div>
        )}
      </div>
    </div>
  );
}

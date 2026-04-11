"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2, AlertCircle, Pencil, Circle, Trash2, MousePointer } from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";

interface Territory {
  id: string;
  name: string;
  color: string;
  cities: string | null;
  travelFee: number | null;
  boundaryType: string;
  polygonCoords: [number, number][] | null;
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number | null;
}

type DrawMode = "none" | "polygon" | "radius";

interface BoundaryData {
  boundaryType: "none" | "polygon" | "radius";
  polygonCoords?: [number, number][];
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

interface TerritoryMapProps {
  territories: Territory[];
  /** When set, enables drawing mode for a specific territory */
  editingTerritoryId?: string | null;
  /** Called when a boundary is drawn/modified */
  onBoundaryChange?: (territoryId: string, boundary: BoundaryData) => void;
}

interface GeoResult {
  lat: number;
  lng: number;
  city: string;
  territory: Territory;
}

// Lightweight geocoding via Nominatim
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
  } catch {
    // ignore
  }
  return null;
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

/** Generate a GeoJSON circle polygon (64-point approximation) */
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

/** Haversine distance in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function TerritoryMap({ territories, editingTerritoryId, onBoundaryChange }: TerritoryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [pointCount, setPointCount] = useState(0);

  // Drawing state
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [radiusCenter, setRadiusCenter] = useState<[number, number] | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [isDraggingRadius, setIsDraggingRadius] = useState(false);

  const drawModeRef = useRef(drawMode);
  const polygonPointsRef = useRef(polygonPoints);
  const radiusCenterRef = useRef(radiusCenter);
  const isDraggingRadiusRef = useRef(isDraggingRadius);

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { polygonPointsRef.current = polygonPoints; }, [polygonPoints]);
  useEffect(() => { radiusCenterRef.current = radiusCenter; }, [radiusCenter]);
  useEffect(() => { isDraggingRadiusRef.current = isDraggingRadius; }, [isDraggingRadius]);

  const isEditing = !!editingTerritoryId;
  const editingTerritory = territories.find((t) => t.id === editingTerritoryId);

  // ─── Render existing territory boundaries ──────────────

  const renderBoundaries = useCallback((map: any, mapboxgl: any) => {
    // Remove old boundary layers/sources
    territories.forEach((t) => {
      const layerId = `territory-fill-${t.id}`;
      const lineId = `territory-line-${t.id}`;
      const srcId = `territory-src-${t.id}`;
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getSource(srcId)) map.removeSource(srcId);
    });

    for (const t of territories) {
      let geojson: any = null;

      if (t.boundaryType === "polygon" && t.polygonCoords && t.polygonCoords.length >= 3) {
        const ring = [...t.polygonCoords];
        // Close the ring if not closed
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          ring.push(ring[0]);
        }
        geojson = {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: {},
        };
      } else if (
        t.boundaryType === "radius" &&
        t.centerLat != null &&
        t.centerLng != null &&
        t.radiusKm != null
      ) {
        geojson = createCircleGeoJSON(t.centerLng, t.centerLat, t.radiusKm);
      }

      if (!geojson) continue;

      const srcId = `territory-src-${t.id}`;
      map.addSource(srcId, { type: "geojson", data: geojson });

      map.addLayer({
        id: `territory-fill-${t.id}`,
        type: "fill",
        source: srcId,
        paint: {
          "fill-color": t.color,
          "fill-opacity": 0.15,
        },
      });

      map.addLayer({
        id: `territory-line-${t.id}`,
        type: "line",
        source: srcId,
        paint: {
          "line-color": t.color,
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });
    }
  }, [territories]);

  // ─── Render drawing layer (active polygon / radius) ────

  const renderDrawing = useCallback((map: any) => {
    const drawSrcId = "draw-preview-src";
    const drawFillId = "draw-preview-fill";
    const drawLineId = "draw-preview-line";
    const drawPointsSrcId = "draw-points-src";
    const drawPointsLayerId = "draw-points-layer";

    // Clean up existing draw layers
    if (map.getLayer(drawFillId)) map.removeLayer(drawFillId);
    if (map.getLayer(drawLineId)) map.removeLayer(drawLineId);
    if (map.getLayer(drawPointsLayerId)) map.removeLayer(drawPointsLayerId);
    if (map.getSource(drawSrcId)) map.removeSource(drawSrcId);
    if (map.getSource(drawPointsSrcId)) map.removeSource(drawPointsSrcId);

    const color = editingTerritory?.color || "#3B82F6";

    if (drawMode === "polygon" && polygonPoints.length >= 1) {
      const ring = [...polygonPoints];
      if (ring.length >= 3) {
        // Close the ring for preview
        ring.push(ring[0]);
        const geojson = {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: {},
        };
        map.addSource(drawSrcId, { type: "geojson", data: geojson });
        map.addLayer({
          id: drawFillId,
          type: "fill",
          source: drawSrcId,
          paint: { "fill-color": color, "fill-opacity": 0.25 },
        });
        map.addLayer({
          id: drawLineId,
          type: "line",
          source: drawSrcId,
          paint: { "line-color": color, "line-width": 2.5 },
        });
      } else if (ring.length === 2) {
        // Just a line
        const geojson = {
          type: "Feature",
          geometry: { type: "LineString", coordinates: ring },
          properties: {},
        };
        map.addSource(drawSrcId, { type: "geojson", data: geojson });
        map.addLayer({
          id: drawLineId,
          type: "line",
          source: drawSrcId,
          paint: { "line-color": color, "line-width": 2.5 },
        });
      }

      // Draw vertex dots
      const pointFeatures = polygonPoints.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: p },
        properties: {},
      }));
      map.addSource(drawPointsSrcId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: pointFeatures },
      });
      map.addLayer({
        id: drawPointsLayerId,
        type: "circle",
        source: drawPointsSrcId,
        paint: {
          "circle-radius": 5,
          "circle-color": color,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });
    }

    if (drawMode === "radius" && radiusCenter) {
      const circleGeoJSON = createCircleGeoJSON(radiusCenter[0], radiusCenter[1], radiusKm);
      map.addSource(drawSrcId, { type: "geojson", data: circleGeoJSON });
      map.addLayer({
        id: drawFillId,
        type: "fill",
        source: drawSrcId,
        paint: { "fill-color": color, "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: drawLineId,
        type: "line",
        source: drawSrcId,
        paint: { "line-color": color, "line-width": 2.5 },
      });

      // Center dot
      map.addSource(drawPointsSrcId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            { type: "Feature", geometry: { type: "Point", coordinates: radiusCenter }, properties: {} },
          ],
        },
      });
      map.addLayer({
        id: drawPointsLayerId,
        type: "circle",
        source: drawPointsSrcId,
        paint: {
          "circle-radius": 6,
          "circle-color": color,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });
    }
  }, [drawMode, polygonPoints, radiusCenter, radiusKm, editingTerritory?.color]);

  // ─── Re-render drawing when state changes ──────────────

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || status !== "ready") return;
    try {
      renderDrawing(map);
    } catch {
      // map might not be fully loaded yet
    }
  }, [drawMode, polygonPoints, radiusCenter, radiusKm, renderDrawing, status]);

  // ─── Main map init ─────────────────────────────────────

  useEffect(() => {
    if (territories.length === 0 && !isEditing) return;
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

        const map = new mapboxgl.Map({
          container: mapRef.current,
          style: MAPBOX_STYLE,
          center: [-98.5795, 39.8283],
          zoom: 3,
          attributionControl: false,
        });

        mapInstanceRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        // Geocode city pins
        const promises: Promise<GeoResult | null>[] = [];
        for (const territory of territories) {
          const cities = (territory.cities ?? "").split(",").map((c) => c.trim()).filter(Boolean);
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

        map.on("load", () => {
          if (cancelled) return;

          // Render saved boundaries
          renderBoundaries(map, mapboxgl);

          // Add city pin markers
          const bounds = new mapboxgl.LngLatBounds();
          let hasBounds = false;

          // Include boundary extents in bounds
          for (const t of territories) {
            if (t.boundaryType === "polygon" && t.polygonCoords) {
              for (const coord of t.polygonCoords) {
                bounds.extend(coord);
                hasBounds = true;
              }
            } else if (t.boundaryType === "radius" && t.centerLat != null && t.centerLng != null) {
              bounds.extend([t.centerLng, t.centerLat]);
              hasBounds = true;
            }
          }

          for (const r of results) {
            bounds.extend([r.lng, r.lat]);
            hasBounds = true;

            const el = document.createElement("div");
            el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
              <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${r.territory.color}" stroke="white" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
            </svg>`;
            el.style.cursor = "pointer";

            const feeLabel = r.territory.travelFee
              ? `<br/><span style="color:#d97706;font-size:11px;">+$${r.territory.travelFee.toFixed(2)} travel fee</span>`
              : "";

            const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "200px" }).setHTML(
              `<div style="font-size:13px;line-height:1.5;">
                <strong style="color:${r.territory.color}">${r.territory.name}</strong><br/>
                <span style="color:#6b7280">${r.city}</span>${feeLabel}
              </div>`
            );

            const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
              .setLngLat([r.lng, r.lat])
              .setPopup(popup)
              .addTo(map);

            markersRef.current.push(marker);
          }

          if (hasBounds) {
            if (results.length === 1 && territories.every((t) => t.boundaryType === "none")) {
              map.flyTo({ center: [results[0].lng, results[0].lat], zoom: 10 });
            } else {
              map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
            }
          }

          setStatus("ready");
        });

        // ─── Click handler for drawing ──────────────────
        map.on("click", (e: any) => {
          const mode = drawModeRef.current;
          if (mode === "none") return;

          const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

          if (mode === "polygon") {
            setPolygonPoints((prev) => [...prev, lngLat]);
          } else if (mode === "radius" && !radiusCenterRef.current) {
            setRadiusCenter(lngLat);
            setRadiusKm(10); // default 10km, user can adjust
          }
        });

        // ─── Mousemove for radius drag ──────────────────
        map.on("mousemove", (e: any) => {
          if (drawModeRef.current === "radius" && radiusCenterRef.current && isDraggingRadiusRef.current) {
            const center = radiusCenterRef.current;
            const dist = haversineKm(center[1], center[0], e.lngLat.lat, e.lngLat.lng);
            setRadiusKm(Math.max(0.5, Math.round(dist * 10) / 10));
          }
        });

      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territories.map((t) => `${t.id}-${t.cities}-${t.color}-${t.boundaryType}`).join("|"), isEditing]);

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

  // ─── Drawing actions ───────────────────────────────────

  function startPolygonDraw() {
    setDrawMode("polygon");
    setPolygonPoints([]);
    setRadiusCenter(null);
    const map = mapInstanceRef.current;
    if (map) map.getCanvas().style.cursor = "crosshair";
  }

  function startRadiusDraw() {
    setDrawMode("radius");
    setRadiusCenter(null);
    setPolygonPoints([]);
    setRadiusKm(10);
    const map = mapInstanceRef.current;
    if (map) map.getCanvas().style.cursor = "crosshair";
  }

  function cancelDraw() {
    setDrawMode("none");
    setPolygonPoints([]);
    setRadiusCenter(null);
    const map = mapInstanceRef.current;
    if (map) map.getCanvas().style.cursor = "";
  }

  function undoLastPoint() {
    setPolygonPoints((prev) => prev.slice(0, -1));
  }

  function confirmDraw() {
    if (!editingTerritoryId || !onBoundaryChange) return;

    if (drawMode === "polygon" && polygonPoints.length >= 3) {
      onBoundaryChange(editingTerritoryId, {
        boundaryType: "polygon",
        polygonCoords: polygonPoints,
      });
    } else if (drawMode === "radius" && radiusCenter) {
      onBoundaryChange(editingTerritoryId, {
        boundaryType: "radius",
        centerLat: radiusCenter[1],
        centerLng: radiusCenter[0],
        radiusKm,
      });
    }

    setDrawMode("none");
    setPolygonPoints([]);
    setRadiusCenter(null);
    const map = mapInstanceRef.current;
    if (map) map.getCanvas().style.cursor = "";
  }

  function clearBoundary() {
    if (!editingTerritoryId || !onBoundaryChange) return;
    onBoundaryChange(editingTerritoryId, { boundaryType: "none" });
    setDrawMode("none");
    setPolygonPoints([]);
    setRadiusCenter(null);
  }

  // ─── Render ────────────────────────────────────────────

  if (territories.length === 0 && !isEditing) {
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
              t.id === editingTerritoryId ? "ring-2 ring-offset-1 ring-blue-400" : ""
            }`}
            style={{
              borderColor: t.color + "66",
              backgroundColor: t.color + "11",
              color: t.color,
            }}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
            {t.name}
            {t.boundaryType !== "none" && (
              <span className="opacity-60 text-[10px]">
                ({t.boundaryType === "polygon" ? "poly" : `${t.radiusKm?.toFixed(0)}km`})
              </span>
            )}
            {t.travelFee ? ` · +$${t.travelFee.toFixed(0)}` : ""}
          </div>
        ))}
      </div>

      {/* Drawing toolbar */}
      {isEditing && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-xs font-medium text-blue-800 mr-1">
            Draw boundary for {editingTerritory?.name}:
          </span>

          {drawMode === "none" ? (
            <>
              <button
                onClick={startPolygonDraw}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Pencil className="w-3 h-3" /> Draw Polygon
              </button>
              <button
                onClick={startRadiusDraw}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Circle className="w-3 h-3" /> Set Radius
              </button>
              {editingTerritory?.boundaryType !== "none" && (
                <button
                  onClick={clearBoundary}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Clear Boundary
                </button>
              )}
            </>
          ) : drawMode === "polygon" ? (
            <>
              <span className="text-xs text-blue-600">
                Click map to add points ({polygonPoints.length} placed)
                {polygonPoints.length < 3 && " — need at least 3"}
              </span>
              {polygonPoints.length > 0 && (
                <button
                  onClick={undoLastPoint}
                  className="px-2 py-1 bg-white border border-blue-200 rounded text-xs text-blue-700 hover:bg-blue-100"
                >
                  Undo
                </button>
              )}
              {polygonPoints.length >= 3 && (
                <button
                  onClick={confirmDraw}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                >
                  Confirm Shape
                </button>
              )}
              <button
                onClick={cancelDraw}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </>
          ) : drawMode === "radius" ? (
            <>
              {!radiusCenter ? (
                <span className="text-xs text-blue-600">Click map to set center point</span>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-blue-700">Radius:</label>
                  <input
                    type="range"
                    min={0.5}
                    max={100}
                    step={0.5}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                    className="w-32 accent-blue-600"
                  />
                  <span className="text-xs font-medium text-blue-800 w-14">
                    {radiusKm < 1 ? `${(radiusKm * 1000).toFixed(0)}m` : `${radiusKm.toFixed(1)}km`}
                  </span>
                  <span className="text-xs text-blue-500">
                    ({(radiusKm * 0.621371).toFixed(1)} mi)
                  </span>
                  <button
                    onClick={confirmDraw}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                  >
                    Confirm
                  </button>
                </div>
              )}
              <button
                onClick={cancelDraw}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </>
          ) : null}
        </div>
      )}

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height: 480 }}>
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

        {/* Drawing mode indicator */}
        {drawMode !== "none" && status === "ready" && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-medium shadow-lg">
            <MousePointer className="w-3 h-3" />
            {drawMode === "polygon" ? "Drawing polygon" : "Setting radius"}
          </div>
        )}
      </div>

      {status === "ready" && pointCount > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Showing {pointCount} location{pointCount !== 1 ? "s" : ""} across {territories.length} territory
          {territories.length !== 1 ? " areas" : ""}.
          {isEditing ? " Use the toolbar above to draw boundaries." : " Click any pin for details."}
        </p>
      )}
    </div>
  );
}

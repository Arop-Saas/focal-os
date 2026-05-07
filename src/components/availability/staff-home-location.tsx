"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Loader2, CheckCircle, MapPin, Search, X, Home,
  Pencil, Circle, Trash2, MousePointer, Undo2,
} from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";

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

// ─── Mapbox Geocoding ────────────────────────────────────

interface GeocodingResult {
  place_name: string;
  center: [number, number]; // [lng, lat]
}

async function searchAddress(query: string): Promise<GeocodingResult[]> {
  if (!query.trim() || !MAPBOX_TOKEN) return [];
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=address,place,locality,neighborhood&limit=5`
    );
    const data = await res.json();
    return (data.features ?? []).map((f: any) => ({
      place_name: f.place_name,
      center: f.center,
    }));
  } catch {
    return [];
  }
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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Types ───────────────────────────────────────────────

type DrawMode = "none" | "polygon" | "radius";

interface CoverageBoundary {
  boundaryType: "none" | "polygon" | "radius";
  polygonCoords?: [number, number][];
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

interface Props {
  staffId: string;
  memberId: string;
  initialAddress?: string | null;
  initialLat?: number | null;
  initialLng?: number | null;
  initialCoverage?: CoverageBoundary | null;
}

// ─── Component ────────────────────────────────────────────

export function StaffHomeLocation({
  staffId,
  memberId,
  initialAddress,
  initialLat,
  initialLng,
  initialCoverage,
}: Props) {
  // ── Address state ──────────────────────────────────────
  const [address, setAddress] = useState(initialAddress ?? "");
  const [lat, setLat] = useState<number | null>(initialLat ?? null);
  const [lng, setLng] = useState<number | null>(initialLng ?? null);

  // ── Search ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // ── Coverage boundary state ────────────────────────────
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>(
    initialCoverage?.boundaryType === "polygon" && initialCoverage.polygonCoords
      ? initialCoverage.polygonCoords : []
  );
  const [radiusCenter, setRadiusCenter] = useState<[number, number] | null>(
    initialCoverage?.boundaryType === "radius" && initialCoverage.centerLng != null && initialCoverage.centerLat != null
      ? [initialCoverage.centerLng, initialCoverage.centerLat] : null
  );
  const [radiusKm, setRadiusKm] = useState<number>(initialCoverage?.radiusKm ?? 10);

  const hasCoverage =
    (polygonPoints.length >= 3 && drawMode === "none") ||
    (radiusCenter !== null && drawMode === "none");

  // Refs for event handlers (needed inside map click callbacks)
  const drawModeRef = useRef(drawMode);
  const polygonPointsRef = useRef(polygonPoints);
  const radiusCenterRef = useRef(radiusCenter);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { polygonPointsRef.current = polygonPoints; }, [polygonPoints]);
  useEffect(() => { radiusCenterRef.current = radiusCenter; }, [radiusCenter]);

  // ── Map refs ───────────────────────────────────────────
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // ── Save state ─────────────────────────────────────────
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const updateMutation = trpc.staff.updateProfile.useMutation({
    onSuccess: () => {
      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const isDrawing = drawMode !== "none";

  // ─── Debounced search ──────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchAddress(searchQuery);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setIsSearching(false);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // ─── Close suggestions on outside click ────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Address actions ───────────────────────────────────

  function selectAddress(result: GeocodingResult) {
    setAddress(result.place_name);
    setLng(result.center[0]);
    setLat(result.center[1]);
    setSearchQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setHasChanges(true);
    updateMapPin(result.center[0], result.center[1]);
  }

  function clearAddress() {
    setAddress("");
    setLat(null);
    setLng(null);
    setSearchQuery("");
    setHasChanges(true);
    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
    const map = mapInstanceRef.current;
    if (map) map.flyTo({ center: [-98.5795, 39.8283], zoom: 3 });
  }

  // ─── Update home pin on map ────────────────────────────

  const updateMapPin = useCallback((pLng: number, pLat: number) => {
    const map = mapInstanceRef.current;
    if (!map || !window.mapboxgl) return;

    if (markerRef.current) {
      markerRef.current.setLngLat([pLng, pLat]);
    } else {
      const el = document.createElement("div");
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#3B82F6" stroke="white" stroke-width="1.5"/>
        <circle cx="12" cy="10" r="4" fill="white" opacity="0.9"/>
        <rect x="10" y="7" width="4" height="6" rx="1" fill="white" opacity="0.9"/>
      </svg>`;
      el.style.cursor = "grab";

      markerRef.current = new window.mapboxgl.Marker({
        element: el,
        anchor: "bottom",
        draggable: true,
      })
        .setLngLat([pLng, pLat])
        .addTo(map);

      markerRef.current.on("dragend", () => {
        const lngLat = markerRef.current.getLngLat();
        setLng(lngLat.lng);
        setLat(lngLat.lat);
        setHasChanges(true);
        reverseGeocode(lngLat.lng, lngLat.lat);
      });
    }

    map.flyTo({ center: [pLng, pLat], zoom: 14 });
  }, []);

  // ─── Reverse geocode ──────────────────────────────────

  async function reverseGeocode(pLng: number, pLat: number) {
    if (!MAPBOX_TOKEN) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${pLng},${pLat}.json?access_token=${MAPBOX_TOKEN}&types=address,place&limit=1`
      );
      const data = await res.json();
      if (data.features?.[0]) {
        setAddress(data.features[0].place_name);
      }
    } catch { /* ignore */ }
  }

  // ─── Render coverage overlays on map ───────────────────

  const renderCoverageOverlays = useCallback((map: any) => {
    // Clean existing layers
    const ids = ["coverage-fill", "coverage-line", "draw-fill", "draw-line", "draw-pts"];
    const srcs = ["coverage-src", "draw-src", "draw-pts-src"];
    ids.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
    srcs.forEach((id) => { if (map.getSource(id)) map.removeSource(id); });

    const color = "#8B5CF6"; // purple for coverage area

    // When NOT drawing, show the saved/confirmed coverage boundary
    if (drawMode === "none") {
      let geojson: any = null;
      if (polygonPoints.length >= 3) {
        const ring = [...polygonPoints, polygonPoints[0]];
        geojson = { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} };
      } else if (radiusCenter) {
        geojson = createCircleGeoJSON(radiusCenter[0], radiusCenter[1], radiusKm);
      }
      if (geojson) {
        map.addSource("coverage-src", { type: "geojson", data: geojson });
        map.addLayer({ id: "coverage-fill", type: "fill", source: "coverage-src", paint: { "fill-color": color, "fill-opacity": 0.15 } });
        map.addLayer({ id: "coverage-line", type: "line", source: "coverage-src", paint: { "line-color": color, "line-width": 2.5, "line-dasharray": [2, 2] } });
      }
      return;
    }

    // When drawing, show the active preview
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
  }, [drawMode, polygonPoints, radiusCenter, radiusKm]);

  // Re-render coverage overlays when state changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || mapStatus !== "ready") return;
    try { renderCoverageOverlays(map); } catch { /* map not ready */ }
  }, [drawMode, polygonPoints, radiusCenter, radiusKm, renderCoverageOverlays, mapStatus]);

  // ─── Map click handler ─────────────────────────────────

  const handleMapClick = useCallback((e: any) => {
    const mode = drawModeRef.current;
    const clickLng = e.lngLat.lng;
    const clickLat = e.lngLat.lat;
    const lngLat: [number, number] = [clickLng, clickLat];

    if (mode === "polygon") {
      // In polygon draw mode — add vertex
      setPolygonPoints((prev) => [...prev, lngLat]);
      setHasChanges(true);
    } else if (mode === "radius") {
      // In radius draw mode — place center
      if (!radiusCenterRef.current) {
        setRadiusCenter(lngLat);
        setRadiusKm(10);
        setHasChanges(true);
      }
    } else {
      // Normal mode — place/move home pin
      setLng(clickLng);
      setLat(clickLat);
      setHasChanges(true);
      updateMapPin(clickLng, clickLat);
      reverseGeocode(clickLng, clickLat);
    }
  }, [updateMapPin]);

  // ─── Init map ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setMapStatus("loading");
      try {
        const mapboxgl = await loadMapboxGL();
        if (cancelled || !mapRef.current) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;

        if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
        if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

        const hasInitialLocation = initialLat != null && initialLng != null;
        const map = new mapboxgl.Map({
          container: mapRef.current,
          style: MAPBOX_STYLE,
          center: hasInitialLocation ? [initialLng!, initialLat!] : [-98.5795, 39.8283],
          zoom: hasInitialLocation ? 12 : 3,
          attributionControl: false,
        });

        mapInstanceRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          if (cancelled) return;
          setMapStatus("ready");
          if (hasInitialLocation) {
            updateMapPin(initialLng!, initialLat!);
          }
          renderCoverageOverlays(map);
        });

        map.on("click", handleMapClick);
      } catch {
        if (!cancelled) setMapStatus("error");
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (markerRef.current) markerRef.current.remove();
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
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
    // Restore previous boundary
    if (initialCoverage?.boundaryType === "polygon" && initialCoverage.polygonCoords) {
      setPolygonPoints(initialCoverage.polygonCoords);
      setRadiusCenter(null);
    } else if (initialCoverage?.boundaryType === "radius" && initialCoverage.centerLng != null && initialCoverage.centerLat != null) {
      setRadiusCenter([initialCoverage.centerLng, initialCoverage.centerLat]);
      setRadiusKm(initialCoverage.radiusKm ?? 10);
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
    setDrawMode("none");
    setHasChanges(true);
  }

  function clearCoverage() {
    setPolygonPoints([]);
    setRadiusCenter(null);
    setDrawMode("none");
    setHasChanges(true);
    const map = mapInstanceRef.current;
    if (map) map.getCanvas().style.cursor = "";
  }

  // ─── Save ──────────────────────────────────────────────

  async function handleSave() {
    // Build coverage data
    let coverageBoundaryType: "none" | "polygon" | "radius" = "none";
    let coveragePolygonCoords: [number, number][] | null = null;
    let coverageCenterLat: number | null = null;
    let coverageCenterLng: number | null = null;
    let coverageRadiusKmVal: number | null = null;

    if (polygonPoints.length >= 3) {
      coverageBoundaryType = "polygon";
      coveragePolygonCoords = polygonPoints;
    } else if (radiusCenter) {
      coverageBoundaryType = "radius";
      coverageCenterLng = radiusCenter[0];
      coverageCenterLat = radiusCenter[1];
      coverageRadiusKmVal = radiusKm;
    }

    await updateMutation.mutateAsync({
      memberId,
      homeAddress: address || null,
      homeLat: lat,
      homeLng: lng,
      coverageBoundaryType,
      coveragePolygonCoords,
      coverageCenterLat,
      coverageCenterLng,
      coverageRadiusKm: coverageRadiusKmVal,
    });
  }

  // ─── Render ────────────────────────────────────────────

  const mapHeight = isDrawing ? 420 : 320;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="w-3.5 h-3.5 text-blue-600" />
          <p className="text-xs font-semibold text-gray-700">Home Location &amp; Coverage Area</p>
        </div>
        <p className="text-xs text-gray-400">Set home address and draw the coverage zone</p>
      </div>

      {/* Address search */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery || address}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (address && e.target.value !== address) setAddress("");
            }}
            onFocus={() => {
              if (address) setSearchQuery(address);
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder="Search for a home address..."
            className="w-full border border-gray-200 rounded-xl pl-9 pr-20 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            {address && (
              <button type="button" onClick={clearAddress} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div ref={suggestionsRef} className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectAddress(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-start gap-2.5"
              >
                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{s.place_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current address display */}
      {address && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-blue-700">{address}</p>
            {lat != null && lng != null && (
              <p className="text-[11px] text-blue-400 mt-0.5">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
            )}
          </div>
        </div>
      )}

      {/* Coverage area drawing toolbar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700">Coverage Area</p>
          <p className="text-[11px] text-gray-400">
            {hasCoverage
              ? polygonPoints.length >= 3
                ? `Polygon with ${polygonPoints.length} points`
                : `${radiusKm.toFixed(1)}km radius`
              : "No coverage area drawn"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {drawMode === "none" ? (
            <>
              <button
                type="button"
                onClick={startPolygonDraw}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors"
              >
                <Pencil className="w-3 h-3" /> Draw Polygon
              </button>
              <button
                type="button"
                onClick={startRadiusDraw}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors"
              >
                <Circle className="w-3 h-3" /> Set Radius
              </button>
              {hasCoverage && (
                <button
                  type="button"
                  onClick={clearCoverage}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </>
          ) : drawMode === "polygon" ? (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-xs font-medium text-purple-700">
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
                <button type="button" onClick={confirmDraw} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700">
                  Confirm Shape
                </button>
              )}
              <button type="button" onClick={cancelDraw} className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </>
          ) : drawMode === "radius" ? (
            <>
              {!radiusCenter ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-xs font-medium text-purple-700">
                  <MousePointer className="w-3 h-3" /> Click map to place center
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Radius:</span>
                    <input
                      type="range"
                      min={0.5}
                      max={100}
                      step={0.5}
                      value={radiusKm}
                      onChange={(e) => { setRadiusKm(parseFloat(e.target.value)); setHasChanges(true); }}
                      className="w-28 accent-purple-600"
                    />
                    <span className="text-xs font-semibold text-gray-700 w-16">{radiusKm.toFixed(1)}km</span>
                    <span className="text-[11px] text-gray-400">({(radiusKm * 0.621371).toFixed(1)}mi)</span>
                  </div>
                  <button type="button" onClick={confirmDraw} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700">
                    Confirm
                  </button>
                </>
              )}
              <button type="button" onClick={cancelDraw} className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </>
          ) : null}
        </div>
      </div>

      {/* Map */}
      <div>
        <p className="text-[11px] text-gray-400 mb-2">
          {isDrawing
            ? drawMode === "polygon"
              ? "Click on the map to place polygon vertices for the coverage area."
              : "Click on the map to set the center of the coverage radius."
            : "Click the map to set the home pin. Use the toolbar above to draw a coverage area."}
        </p>
        <div
          className="relative rounded-xl overflow-hidden border border-gray-200 transition-all duration-300"
          style={{ height: mapHeight }}
        >
          <div ref={mapRef} style={{ height: "100%", width: "100%" }} />

          {mapStatus === "loading" && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center gap-2 z-10">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs text-gray-500">Loading map...</span>
            </div>
          )}
          {mapStatus === "error" && (
            <div className="absolute inset-0 bg-white/90 flex items-center justify-center gap-2 z-10">
              <span className="text-sm text-gray-500">Could not load map</span>
            </div>
          )}

          {/* Drawing mode badge */}
          {isDrawing && mapStatus === "ready" && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 text-white rounded-full text-[11px] font-medium shadow-lg">
              <MousePointer className="w-3 h-3" />
              {drawMode === "polygon" ? "Drawing coverage polygon" : "Setting coverage radius"}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          Home location (blue pin)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          Coverage area (purple zone)
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center justify-between pt-1">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle className="w-3.5 h-3.5" /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending || !hasChanges}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Location &amp; Coverage
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { Loader2, CheckCircle, MapPin, Search, X, Home } from "lucide-react";

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

// ─── Component ────────────────────────────────────────────

interface Props {
  staffId: string;
  memberId: string;
  initialAddress?: string | null;
  initialLat?: number | null;
  initialLng?: number | null;
}

export function StaffHomeLocation({
  staffId,
  memberId,
  initialAddress,
  initialLat,
  initialLng,
}: Props) {
  // Address state
  const [address, setAddress] = useState(initialAddress ?? "");
  const [lat, setLat] = useState<number | null>(initialLat ?? null);
  const [lng, setLng] = useState<number | null>(initialLng ?? null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Map
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // Save state
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const updateMutation = trpc.staff.updateProfile.useMutation({
    onSuccess: () => {
      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 2500);
    },
  });

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

  // ─── Close suggestions on outside click ─────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Select address from suggestions ───────────────────

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

  // ─── Clear address ─────────────────────────────────────

  function clearAddress() {
    setAddress("");
    setLat(null);
    setLng(null);
    setSearchQuery("");
    setHasChanges(true);
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    // Reset map view
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo({ center: [-98.5795, 39.8283], zoom: 3 });
    }
  }

  // ─── Update map pin ────────────────────────────────────

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

      // Handle drag end — update coordinates
      markerRef.current.on("dragend", () => {
        const lngLat = markerRef.current.getLngLat();
        setLng(lngLat.lng);
        setLat(lngLat.lat);
        setHasChanges(true);

        // Reverse geocode to get address
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
    } catch {
      // ignore
    }
  }

  // ─── Map click to place pin ────────────────────────────

  const handleMapClick = useCallback((e: any) => {
    const newLng = e.lngLat.lng;
    const newLat = e.lngLat.lat;
    setLng(newLng);
    setLat(newLat);
    setHasChanges(true);
    updateMapPin(newLng, newLat);
    reverseGeocode(newLng, newLat);
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

        // Destroy previous
        if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
        if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

        const hasInitialLocation = initialLat != null && initialLng != null;
        const map = new mapboxgl.Map({
          container: mapRef.current,
          style: MAPBOX_STYLE,
          center: hasInitialLocation ? [initialLng!, initialLat!] : [-98.5795, 39.8283],
          zoom: hasInitialLocation ? 14 : 3,
          attributionControl: false,
        });

        mapInstanceRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          if (cancelled) return;
          setMapStatus("ready");

          // Place initial marker
          if (hasInitialLocation) {
            updateMapPin(initialLng!, initialLat!);
          }
        });

        // Click to place/move pin
        map.on("click", handleMapClick);
      } catch {
        if (!cancelled) setMapStatus("error");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (markerRef.current) markerRef.current.remove();
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  // ─── Save ──────────────────────────────────────────────

  async function handleSave() {
    await updateMutation.mutateAsync({
      memberId,
      homeAddress: address || null,
      homeLat: lat,
      homeLng: lng,
    });
  }

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="w-3.5 h-3.5 text-blue-600" />
          <p className="text-xs font-semibold text-gray-700">Home Location</p>
        </div>
        <p className="text-xs text-gray-400">Where this staff member is based</p>
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
              if (address && e.target.value !== address) {
                setAddress("");
              }
            }}
            onFocus={() => {
              if (address) {
                setSearchQuery(address);
              }
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder="Search for an address..."
            className="w-full border border-gray-200 rounded-xl pl-9 pr-20 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            {address && (
              <button
                type="button"
                onClick={clearAddress}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
          >
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
              <p className="text-[11px] text-blue-400 mt-0.5">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Map with draggable pin */}
      <div>
        <p className="text-[11px] text-gray-400 mb-2">
          Click on the map to place a pin, or drag the pin to adjust the location.
        </p>
        <div
          className="relative rounded-xl overflow-hidden border border-gray-200"
          style={{ height: 280 }}
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
          Save Location
        </button>
      </div>
    </div>
  );
}

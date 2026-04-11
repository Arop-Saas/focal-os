"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import {
  Plus,
  MapPin,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  DollarSign,
  List,
  Map,
  Target,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { TerritoryMap } from "./territory-map";
import { CityAutocomplete } from "@/components/shared/city-autocomplete";
import { TerritoryDrawMap } from "./territory-draw-map";

const PRESET_COLORS = [
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
];

interface Territory {
  id: string;
  name: string;
  color: string;
  description: string | null;
  cities: string | null;
  travelFee: number | null;
  boundaryType: string;
  polygonCoords: [number, number][] | null;
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number | null;
  outsideBookingEnabled: boolean;
  outsideFeeType: string;
  outsideTerritoryFee: number | null;
  outsidePerKmRate: number | null;
  outsideFeeBaseKm: number | null;
}

interface BoundaryData {
  boundaryType: "none" | "polygon" | "radius";
  polygonCoords?: [number, number][];
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

interface TerritoryFormData {
  name: string;
  color: string;
  description: string;
  cities: string;
  travelFee?: number;
  boundary?: BoundaryData;
  outsideBookingEnabled?: boolean;
  outsideFeeType?: "flat" | "per_km";
  outsideTerritoryFee?: number | null;
  outsidePerKmRate?: number | null;
  outsideFeeBaseKm?: number | null;
}

interface Props {
  initialTerritories: Territory[];
  initialOutsideSettings?: any; // kept for backwards compat, ignored now
}

// ─── Outside Settings Inline Section ────────────────────────

function OutsideSettingsSection({
  enabled,
  setEnabled,
  feeType,
  setFeeType,
  flatFee,
  setFlatFee,
  perKmRate,
  setPerKmRate,
  baseKm,
  setBaseKm,
}: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  feeType: "flat" | "per_km";
  setFeeType: (v: "flat" | "per_km") => void;
  flatFee: string;
  setFlatFee: (v: string) => void;
  perKmRate: string;
  setPerKmRate: (v: string) => void;
  baseKm: string;
  setBaseKm: (v: string) => void;
}) {
  return (
    <div className="space-y-3 p-3.5 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-gray-700">Outside Boundary Bookings</span>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {!enabled && (
        <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5">
          Bookings outside this territory's boundary will be blocked.
        </p>
      )}

      {enabled && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFeeType("flat")}
              className={`flex-1 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                feeType === "flat"
                  ? "border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              Flat Rate
            </button>
            <button
              type="button"
              onClick={() => setFeeType("per_km")}
              className={`flex-1 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                feeType === "per_km"
                  ? "border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              Per Kilometer
            </button>
          </div>

          {feeType === "flat" && (
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Outside travel fee</label>
              <div className="relative w-32">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={flatFee}
                  onChange={(e) => setFlatFee(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {feeType === "per_km" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">$/km</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={perKmRate}
                    onChange={(e) => setPerKmRate(e.target.value)}
                    placeholder="1.50"
                    className="w-full border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Free km</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={baseKm}
                    onChange={(e) => setBaseKm(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">km</span>
                </div>
              </div>
              {perKmRate && (
                <div className="col-span-2 text-[11px] text-gray-500 bg-white rounded-md p-2 border border-gray-100">
                  Example: 25km outside =
                  <strong className="text-gray-700">
                    {" "}${(Math.max(0, 25 - (parseFloat(baseKm) || 0)) * (parseFloat(perKmRate) || 0)).toFixed(2)}
                  </strong>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Territory Form ─────────────────────────────────────────

function TerritoryForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial?: Partial<Territory>;
  onSave: (data: TerritoryFormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#3B82F6");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cities, setCities] = useState(initial?.cities ?? "");
  const [travelFee, setTravelFee] = useState(
    initial?.travelFee != null ? String(initial.travelFee) : ""
  );

  // Boundary state
  const [boundaryData, setBoundaryData] = useState<BoundaryData>(() => {
    if (initial?.boundaryType === "polygon" && initial.polygonCoords) {
      return { boundaryType: "polygon", polygonCoords: initial.polygonCoords };
    }
    if (initial?.boundaryType === "radius" && initial.centerLat != null && initial.centerLng != null) {
      return { boundaryType: "radius", centerLat: initial.centerLat, centerLng: initial.centerLng, radiusKm: initial.radiusKm ?? 10 };
    }
    return { boundaryType: "none" };
  });

  // Outside settings state
  const [outsideEnabled, setOutsideEnabled] = useState(initial?.outsideBookingEnabled ?? true);
  const [outsideFeeType, setOutsideFeeType] = useState<"flat" | "per_km">(
    (initial?.outsideFeeType as "flat" | "per_km") ?? "flat"
  );
  const [outsideFlatFee, setOutsideFlatFee] = useState(
    initial?.outsideTerritoryFee != null ? String(initial.outsideTerritoryFee) : ""
  );
  const [outsidePerKmRate, setOutsidePerKmRate] = useState(
    initial?.outsidePerKmRate != null ? String(initial.outsidePerKmRate) : ""
  );
  const [outsideBaseKm, setOutsideBaseKm] = useState(
    initial?.outsideFeeBaseKm != null ? String(initial.outsideFeeBaseKm) : ""
  );

  // Geocode cities for map preview
  const [cityMarkers, setCityMarkers] = useState<{ lat: number; lng: number; name: string }[]>([]);
  const geocodeCacheRef = useRef<Record<string, { lat: number; lng: number } | null>>({});

  useEffect(() => {
    const cityList = cities.split(",").map((c) => c.trim()).filter(Boolean);
    if (cityList.length === 0) {
      setCityMarkers([]);
      return;
    }

    let cancelled = false;

    async function geocodeAll() {
      const results: { lat: number; lng: number; name: string }[] = [];
      for (const city of cityList) {
        const key = city.toLowerCase();
        if (geocodeCacheRef.current[key] !== undefined) {
          const cached = geocodeCacheRef.current[key];
          if (cached) results.push({ ...cached, name: city });
          continue;
        }
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          if (data?.[0]) {
            const geo = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            geocodeCacheRef.current[key] = geo;
            results.push({ ...geo, name: city });
          } else {
            geocodeCacheRef.current[key] = null;
          }
        } catch {
          geocodeCacheRef.current[key] = null;
        }
      }
      if (!cancelled) setCityMarkers(results);
    }

    geocodeAll();
    return () => { cancelled = true; };
  }, [cities]);

  function handleSave() {
    const fee = parseFloat(travelFee);
    const flatFee = parseFloat(outsideFlatFee);
    const perKm = parseFloat(outsidePerKmRate);
    const baseKm = parseFloat(outsideBaseKm);
    onSave({
      name,
      color,
      description,
      cities,
      travelFee: isNaN(fee) ? undefined : fee,
      boundary: boundaryData.boundaryType !== "none" ? boundaryData : undefined,
      outsideBookingEnabled: outsideEnabled,
      outsideFeeType,
      outsideTerritoryFee: isNaN(flatFee) ? null : flatFee,
      outsidePerKmRate: isNaN(perKm) ? null : perKm,
      outsideFeeBaseKm: isNaN(baseKm) ? null : baseKm,
    });
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Territory Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Edmonton Metro"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "#111" : "transparent",
                  boxShadow: color === c ? "0 0 0 1px #fff inset" : "none",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Cities / Regions Served</label>
        <CityAutocomplete
          value={cities}
          onChange={setCities}
          chipColor={color}
          placeholder="Search for a city..."
        />
      </div>

      {/* Map preview with boundary drawing */}
      {cityMarkers.length > 0 && (
        <TerritoryDrawMap
          color={color}
          cityMarkers={cityMarkers}
          initialBoundary={boundaryData}
          onBoundaryChange={setBoundaryData}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <DollarSign className="inline w-3 h-3 mr-0.5" />
            Travel Fee (optional)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={travelFee}
              onChange={(e) => setTravelFee(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Flat fee added to jobs in this area</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Covers greater Edmonton, within 50km"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      {/* Outside boundary settings — inline in form */}
      <OutsideSettingsSection
        enabled={outsideEnabled}
        setEnabled={setOutsideEnabled}
        feeType={outsideFeeType}
        setFeeType={setOutsideFeeType}
        flatFee={outsideFlatFee}
        setFlatFee={setOutsideFlatFee}
        perKmRate={outsidePerKmRate}
        setPerKmRate={setOutsidePerKmRate}
        baseKm={outsideBaseKm}
        setBaseKm={setOutsideBaseKm}
      />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim() || isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Save Territory
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Manager ───────────────────────────────────────────

export function TerritoriesManager({ initialTerritories }: Props) {
  const router = useRouter();
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [drawingTerritoryId, setDrawingTerritoryId] = useState<string | null>(null);
  function buildMutationData(data: TerritoryFormData) {
    const { boundary, outsideBookingEnabled, outsideFeeType, outsideTerritoryFee, outsidePerKmRate, outsideFeeBaseKm, ...rest } = data;
    const boundaryInput = boundary
      ? boundary.boundaryType === "polygon"
        ? { boundaryType: "polygon" as const, polygonCoords: boundary.polygonCoords! }
        : boundary.boundaryType === "radius"
        ? { boundaryType: "radius" as const, centerLat: boundary.centerLat!, centerLng: boundary.centerLng!, radiusKm: boundary.radiusKm! }
        : { boundaryType: "none" as const }
      : undefined;
    return {
      ...rest,
      ...(boundaryInput ? { boundary: boundaryInput } : {}),
      outsideBookingEnabled,
      outsideFeeType,
      outsideTerritoryFee,
      outsidePerKmRate,
      outsideFeeBaseKm,
    };
  }

  function mapResult(t: any): Territory {
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      description: t.description ?? null,
      cities: t.cities ?? null,
      travelFee: t.travelFee ?? null,
      boundaryType: t.boundaryType ?? "none",
      polygonCoords: t.polygonCoords ?? null,
      centerLat: t.centerLat ?? null,
      centerLng: t.centerLng ?? null,
      radiusKm: t.radiusKm ?? null,
      outsideBookingEnabled: t.outsideBookingEnabled ?? true,
      outsideFeeType: t.outsideFeeType ?? "flat",
      outsideTerritoryFee: t.outsideTerritoryFee ?? null,
      outsidePerKmRate: t.outsidePerKmRate ?? null,
      outsideFeeBaseKm: t.outsideFeeBaseKm ?? null,
    };
  }

  const createMutation = api.territories.create.useMutation({
    onSuccess: (newT) => {
      setTerritories((prev) => [...prev, mapResult(newT)]);
      setShowCreate(false);
      router.refresh();
    },
  });

  const updateMutation = api.territories.update.useMutation({
    onSuccess: (updated) => {
      setTerritories((prev) =>
        prev.map((t) => (t.id === updated.id ? mapResult(updated) : t))
      );
      setEditingId(null);
      setDrawingTerritoryId(null);
      router.refresh();
    },
  });

  const deleteMutation = api.territories.delete.useMutation({
    onSuccess: (_, { id }) => {
      setTerritories((prev) => prev.filter((t) => t.id !== id));
      setDeletingId(null);
      router.refresh();
    },
  });

  function handleBoundaryChange(territoryId: string, boundary: BoundaryData) {
    const boundaryInput =
      boundary.boundaryType === "polygon"
        ? { boundaryType: "polygon" as const, polygonCoords: boundary.polygonCoords! }
        : boundary.boundaryType === "radius"
        ? {
            boundaryType: "radius" as const,
            centerLat: boundary.centerLat!,
            centerLng: boundary.centerLng!,
            radiusKm: boundary.radiusKm!,
          }
        : { boundaryType: "none" as const };

    updateMutation.mutate({
      id: territoryId,
      boundary: boundaryInput,
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <MapPin className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Service Territories</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Define the areas your studio covers — draw boundaries and set travel fees.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => { setViewMode("list"); setDrawingTerritoryId(null); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "map"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Map className="w-3.5 h-3.5" /> Map
            </button>
          </div>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <TerritoryForm
          onSave={(data) => createMutation.mutate(buildMutationData(data))}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
        />
      )}

      {/* Map view */}
      {viewMode === "map" && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          {territories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Draw boundary:</span>
              {territories.map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    setDrawingTerritoryId(drawingTerritoryId === t.id ? null : t.id)
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    drawingTerritoryId === t.id
                      ? "ring-2 ring-offset-1 ring-blue-400 border-blue-300 bg-blue-50"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Target className="w-3 h-3" style={{ color: t.color }} />
                  {t.name}
                </button>
              ))}
            </div>
          )}

          <TerritoryMap
            territories={territories}
            editingTerritoryId={drawingTerritoryId}
            onBoundaryChange={handleBoundaryChange}
          />

          {updateMutation.isPending && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving boundary…
            </div>
          )}
        </div>
      )}

      {/* Territory list */}
      {viewMode === "list" && territories.length === 0 && !showCreate ? (
        <div className="bg-white rounded-xl border p-10 text-center">
          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <MapPin className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700">No territories yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Add your first service territory to get started.
          </p>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-3">
          {territories.map((territory) =>
            editingId === territory.id ? (
              <TerritoryForm
                key={territory.id}
                initial={territory}
                onSave={(data) =>
                  updateMutation.mutate({ id: territory.id, ...buildMutationData(data) })
                }
                onCancel={() => setEditingId(null)}
                isPending={updateMutation.isPending}
              />
            ) : (
              <div
                key={territory.id}
                className="bg-white rounded-xl border overflow-hidden"
              >
                <div className="p-5 flex items-start gap-4">
                  <div
                    className="h-10 w-10 rounded-full shrink-0 mt-0.5"
                    style={{ backgroundColor: territory.color }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{territory.name}</p>
                      {territory.travelFee != null && territory.travelFee > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <DollarSign className="w-3 h-3" />
                          {formatCurrency(territory.travelFee)} travel fee
                        </span>
                      )}
                      {territory.boundaryType !== "none" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                          <Target className="w-3 h-3" />
                          {territory.boundaryType === "polygon"
                            ? "Polygon boundary"
                            : `${territory.radiusKm?.toFixed(1)}km radius`}
                        </span>
                      )}
                      {/* Outside booking badge */}
                      {territory.boundaryType !== "none" && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                            territory.outsideBookingEnabled
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-red-50 text-red-600 border-red-200"
                          }`}
                        >
                          {territory.outsideBookingEnabled ? "Outside: allowed" : "Outside: blocked"}
                        </span>
                      )}
                    </div>

                    {territory.cities && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {territory.cities.split(",").map((city) => (
                          <span
                            key={city.trim()}
                            className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: territory.color + "22",
                              color: territory.color,
                              border: `1px solid ${territory.color}44`,
                            }}
                          >
                            {city.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Outside fee summary */}
                    {territory.boundaryType !== "none" && territory.outsideBookingEnabled && (
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        Outside fee:{" "}
                        {territory.outsideFeeType === "per_km"
                          ? `$${territory.outsidePerKmRate ?? 0}/km${territory.outsideFeeBaseKm ? ` (first ${territory.outsideFeeBaseKm}km free)` : ""}`
                          : territory.outsideTerritoryFee
                          ? `${formatCurrency(territory.outsideTerritoryFee)} flat`
                          : "None"}
                      </p>
                    )}

                    {territory.description && (
                      <p className="text-xs text-gray-500 mt-2">{territory.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setViewMode("map");
                        setDrawingTerritoryId(territory.id);
                      }}
                      title="Draw boundary on map"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Target className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(territory.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {deletingId === territory.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteMutation.mutate({ id: territory.id })}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(territory.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

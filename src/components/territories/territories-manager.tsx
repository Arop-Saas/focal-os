"use client";

import { useState } from "react";
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
}

interface BoundaryData {
  boundaryType: "none" | "polygon" | "radius";
  polygonCoords?: [number, number][];
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

interface OutsideSettings {
  outsideBookingEnabled: boolean;
  outsideFeeType: "flat" | "per_km";
  outsideTerritoryFee: number | null;
  outsidePerKmRate: number | null;
  outsideFeeBaseKm: number | null;
}

interface Props {
  initialTerritories: Territory[];
  initialOutsideSettings?: OutsideSettings;
}

function TerritoryForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial?: Partial<Territory>;
  onSave: (data: {
    name: string;
    color: string;
    description: string;
    cities: string;
    travelFee?: number;
  }) => void;
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

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            const fee = parseFloat(travelFee);
            onSave({
              name,
              color,
              description,
              cities,
              travelFee: isNaN(fee) ? undefined : fee,
            });
          }}
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

export function TerritoriesManager({ initialTerritories, initialOutsideSettings }: Props) {
  const router = useRouter();
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [drawingTerritoryId, setDrawingTerritoryId] = useState<string | null>(null);

  // Outside-territory settings
  const defaults: OutsideSettings = {
    outsideBookingEnabled: true,
    outsideFeeType: "flat",
    outsideTerritoryFee: null,
    outsidePerKmRate: null,
    outsideFeeBaseKm: null,
  };
  const initial = { ...defaults, ...initialOutsideSettings };
  const [outsideEnabled, setOutsideEnabled] = useState(initial.outsideBookingEnabled);
  const [outsideFeeType, setOutsideFeeType] = useState<"flat" | "per_km">(initial.outsideFeeType);
  const [outsideFlatFee, setOutsideFlatFee] = useState(initial.outsideTerritoryFee != null ? String(initial.outsideTerritoryFee) : "");
  const [outsidePerKmRate, setOutsidePerKmRate] = useState(initial.outsidePerKmRate != null ? String(initial.outsidePerKmRate) : "");
  const [outsideBaseKm, setOutsideBaseKm] = useState(initial.outsideFeeBaseKm != null ? String(initial.outsideFeeBaseKm) : "");
  const [outsideSaved, setOutsideSaved] = useState(false);

  const saveOutsideSettingsMutation = api.territories.saveOutsideSettings.useMutation({
    onSuccess: () => {
      setOutsideSaved(true);
      setTimeout(() => setOutsideSaved(false), 2000);
    },
  });

  function handleSaveOutsideSettings() {
    const flatFee = parseFloat(outsideFlatFee);
    const perKm = parseFloat(outsidePerKmRate);
    const baseKm = parseFloat(outsideBaseKm);
    saveOutsideSettingsMutation.mutate({
      outsideBookingEnabled: outsideEnabled,
      outsideFeeType,
      outsideTerritoryFee: isNaN(flatFee) ? null : flatFee,
      outsidePerKmRate: isNaN(perKm) ? null : perKm,
      outsideFeeBaseKm: isNaN(baseKm) ? null : baseKm,
    });
  }

  const createMutation = api.territories.create.useMutation({
    onSuccess: (newT) => {
      setTerritories((prev) => [
        ...prev,
        {
          ...newT,
          travelFee: (newT as Territory).travelFee ?? null,
          boundaryType: (newT as any).boundaryType ?? "none",
          polygonCoords: (newT as any).polygonCoords ?? null,
          centerLat: (newT as any).centerLat ?? null,
          centerLng: (newT as any).centerLng ?? null,
          radiusKm: (newT as any).radiusKm ?? null,
        },
      ]);
      setShowCreate(false);
      router.refresh();
    },
  });

  const updateMutation = api.territories.update.useMutation({
    onSuccess: (updated) => {
      setTerritories((prev) =>
        prev.map((t) =>
          t.id === updated.id
            ? {
                ...updated,
                travelFee: (updated as Territory).travelFee ?? null,
                boundaryType: (updated as any).boundaryType ?? "none",
                polygonCoords: (updated as any).polygonCoords ?? null,
                centerLat: (updated as any).centerLat ?? null,
                centerLng: (updated as any).centerLng ?? null,
                radiusKm: (updated as any).radiusKm ?? null,
              }
            : t
        )
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
    // Build the boundary input for tRPC
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

      {/* Outside-territory booking settings */}
      {territories.some((t) => t.boundaryType !== "none") && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Outside Territory Bookings</p>
                <p className="text-xs text-gray-500">
                  Control what happens when a booking address is outside all your territories.
                </p>
              </div>
            </div>
            {/* Enable/Disable toggle */}
            <button
              type="button"
              onClick={() => { setOutsideEnabled(!outsideEnabled); setOutsideSaved(false); }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                outsideEnabled ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                  outsideEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {!outsideEnabled && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <X className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700">
                Bookings outside your defined territories will be blocked. Customers will see a message that the address is not in your service area.
              </p>
            </div>
          )}

          {outsideEnabled && (
            <div className="space-y-4">
              {/* Fee type selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Fee type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setOutsideFeeType("flat"); setOutsideSaved(false); }}
                    className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      outsideFeeType === "flat"
                        ? "border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                        : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="block text-sm font-semibold">Flat Rate</span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">Same fee regardless of distance</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOutsideFeeType("per_km"); setOutsideSaved(false); }}
                    className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      outsideFeeType === "per_km"
                        ? "border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                        : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="block text-sm font-semibold">Per Kilometer</span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">Charge based on distance from boundary</span>
                  </button>
                </div>
              </div>

              {/* Flat rate fields */}
              {outsideFeeType === "flat" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Travel fee amount</label>
                  <div className="relative w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={outsideFlatFee}
                      onChange={(e) => { setOutsideFlatFee(e.target.value); setOutsideSaved(false); }}
                      placeholder="0.00"
                      className="w-full border border-gray-200 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Per-km rate fields */}
              {outsideFeeType === "per_km" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rate per kilometer</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={outsidePerKmRate}
                        onChange={(e) => { setOutsidePerKmRate(e.target.value); setOutsideSaved(false); }}
                        placeholder="1.50"
                        className="w-full border border-gray-200 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Per km beyond the nearest territory boundary
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Free kilometers</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={outsideBaseKm}
                        onChange={(e) => { setOutsideBaseKm(e.target.value); setOutsideSaved(false); }}
                        placeholder="0"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">km</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      No charge for the first N km outside boundary
                    </p>
                  </div>
                  {outsidePerKmRate && outsideBaseKm && (
                    <div className="col-span-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5">
                      Example: A job 25km outside your territory =
                      <strong className="text-gray-700">
                        {" "}${(Math.max(0, 25 - (parseFloat(outsideBaseKm) || 0)) * (parseFloat(outsidePerKmRate) || 0)).toFixed(2)}
                      </strong>
                      {" "}travel fee ({Math.max(0, 25 - (parseFloat(outsideBaseKm) || 0))}km x ${parseFloat(outsidePerKmRate) || 0}/km)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSaveOutsideSettings}
              disabled={saveOutsideSettingsMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {saveOutsideSettingsMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : outsideSaved ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {outsideSaved ? "Saved" : "Save Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <TerritoryForm
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
        />
      )}

      {/* Map view */}
      {viewMode === "map" && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          {/* Territory selector for boundary drawing */}
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
                onSave={(data) => updateMutation.mutate({ id: territory.id, ...data })}
                onCancel={() => setEditingId(null)}
                isPending={updateMutation.isPending}
              />
            ) : (
              <div
                key={territory.id}
                className="bg-white rounded-xl border p-5 flex items-start gap-4"
              >
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
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

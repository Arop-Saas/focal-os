"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";

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
}

interface Props {
  initialTerritories: Territory[];
}

function TerritoryForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial?: Partial<Territory>;
  onSave: (data: { name: string; color: string; description: string; cities: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#3B82F6");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cities, setCities] = useState(initial?.cities ?? "");

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
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

        {/* Color */}
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

      {/* Cities */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Cities / Regions Served</label>
        <input
          type="text"
          value={cities}
          onChange={(e) => setCities(e.target.value)}
          placeholder="e.g. Edmonton, St. Albert, Leduc, Spruce Grove"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">Separate multiple cities with commas</p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Covers the greater Edmonton area, within 50km radius"
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave({ name, color, description, cities })}
          disabled={!name.trim() || isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
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

export function TerritoriesManager({ initialTerritories }: Props) {
  const router = useRouter();
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const createMutation = api.territories.create.useMutation({
    onSuccess: (newT) => {
      setTerritories((prev) => [...prev, newT]);
      setShowCreate(false);
      router.refresh();
    },
  });

  const updateMutation = api.territories.update.useMutation({
    onSuccess: (updated) => {
      setTerritories((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingId(null);
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

  return (
    <div className="max-w-2xl space-y-4">
      {/* Header card */}
      <div className="bg-white rounded-xl border p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <MapPin className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Service Territories</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Define the areas your studio covers — useful for multi-location or regional businesses.
            </p>
          </div>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Territory
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <TerritoryForm
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
        />
      )}

      {/* Territory list */}
      {territories.length === 0 && !showCreate ? (
        <div className="bg-white rounded-xl border p-10 text-center">
          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <MapPin className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700">No territories yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Add your first service territory to get started.
          </p>
        </div>
      ) : (
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
                {/* Color dot */}
                <div
                  className="h-10 w-10 rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: territory.color }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{territory.name}</p>

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

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
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
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { CheckCircle2, Circle, Plus, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  jobId: string;
}

type Stage = "Pre-shoot" | "Shoot" | "Post-shoot" | "Delivery" | "Custom";

const STAGE_ORDER: Stage[] = ["Pre-shoot", "Shoot", "Post-shoot", "Delivery", "Custom"];

const STAGE_STYLES: Record<Stage, { badge: string; dot: string }> = {
  "Pre-shoot":  { badge: "bg-purple-50 text-purple-600 border-purple-100",  dot: "bg-purple-400" },
  "Shoot":      { badge: "bg-blue-50 text-blue-600 border-blue-100",        dot: "bg-blue-400" },
  "Post-shoot": { badge: "bg-amber-50 text-amber-600 border-amber-100",     dot: "bg-amber-400" },
  "Delivery":   { badge: "bg-green-50 text-green-600 border-green-100",     dot: "bg-green-400" },
  "Custom":     { badge: "bg-gray-50 text-gray-500 border-gray-200",        dot: "bg-gray-400" },
};

const PRE_SHOOT_LABELS = [
  "confirm appointment", "send prep guide", "review order", "check equipment",
  "charge batteries", "schedule", "brief client", "review property",
];
const SHOOT_LABELS = [
  "arrive on site", "set up equipment", "shoot exterior", "shoot interior",
  "capture details", "twilight shots", "drone photos", "drone video",
  "walkthrough video", "floor plan", "matterport", "3d scan",
];
const POST_SHOOT_LABELS = [
  "import photos", "cull photos", "edit photos", "color grade",
  "retouch", "virtual staging", "edit video", "export files",
  "quality check", "process floor plan",
];
const DELIVERY_LABELS = [
  "upload to portal", "send download link", "deliver to client",
  "notify client", "get approval", "send invoice", "follow up",
];

function getStage(label: string): Stage {
  const l = label.toLowerCase().trim();
  if (PRE_SHOOT_LABELS.some((s) => l.includes(s))) return "Pre-shoot";
  if (SHOOT_LABELS.some((s) => l.includes(s))) return "Shoot";
  if (POST_SHOOT_LABELS.some((s) => l.includes(s))) return "Post-shoot";
  if (DELIVERY_LABELS.some((s) => l.includes(s))) return "Delivery";
  return "Custom";
}

export function JobChecklist({ jobId }: Props) {
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<Stage, boolean>>({
    "Pre-shoot": false,
    "Shoot": false,
    "Post-shoot": false,
    "Delivery": false,
    "Custom": false,
  });

  const { data: items = [], isLoading, refetch } = api.checklist.list.useQuery({ jobId });

  const toggleMutation = api.checklist.toggle.useMutation({ onSuccess: () => refetch() });
  const addMutation = api.checklist.add.useMutation({
    onSuccess: () => { setNewLabel(""); setAdding(false); refetch(); },
  });
  const deleteMutation = api.checklist.delete.useMutation({ onSuccess: () => refetch() });

  const completed = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Group items by stage
  const grouped: Record<Stage, typeof items> = {
    "Pre-shoot": [],
    "Shoot": [],
    "Post-shoot": [],
    "Delivery": [],
    "Custom": [],
  };
  for (const item of items) {
    const stage = getStage(item.label);
    grouped[stage].push(item);
  }

  const toggleCollapse = (stage: Stage) => {
    setCollapsed((prev) => ({ ...prev, [stage]: !prev[stage] }));
  };

  return (
    <div className="bg-white rounded-xl border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Job Checklist</span>
          {total > 0 && (
            <span className="text-xs text-gray-400">{completed}/{total}</span>
          )}
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add item
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-4">
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">{pct}% complete</p>
        </div>
      )}

      {/* Add input */}
      {adding && (
        <div className="flex items-center gap-2 mb-3">
          <input
            autoFocus
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newLabel.trim()) addMutation.mutate({ jobId, label: newLabel.trim() });
              if (e.key === "Escape") { setAdding(false); setNewLabel(""); }
            }}
            placeholder="New checklist item..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => { if (newLabel.trim()) addMutation.mutate({ jobId, label: newLabel.trim() }); }}
            disabled={!newLabel.trim() || addMutation.isPending}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : total === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No checklist items yet. Add one above.</p>
      ) : (
        <div className="space-y-3">
          {STAGE_ORDER.map((stage) => {
            const stageItems = grouped[stage];
            if (stageItems.length === 0) return null;
            const stageDone = stageItems.filter((i) => i.checked).length;
            const isCollapsed = collapsed[stage];
            const styles = STAGE_STYLES[stage];

            return (
              <div key={stage}>
                {/* Stage header */}
                <button
                  onClick={() => toggleCollapse(stage)}
                  className="flex items-center gap-2 w-full text-left mb-1.5 group"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  )}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${styles.badge}`}>
                    {stage}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto">
                    {stageDone}/{stageItems.length}
                  </span>
                </button>

                {/* Stage items */}
                {!isCollapsed && (
                  <div className="space-y-0.5 pl-5">
                    {stageItems.map((item) => (
                      <div
                        key={item.id}
                        className="group/item flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <button
                          onClick={() => toggleMutation.mutate({ id: item.id, checked: !item.checked })}
                          disabled={toggleMutation.isPending}
                          className="shrink-0 transition-colors"
                        >
                          {item.checked ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-gray-300 hover:text-gray-400" />
                          )}
                        </button>
                        <span className={`flex-1 text-sm transition-colors ${
                          item.checked ? "line-through text-gray-400" : "text-gray-700"
                        }`}>
                          {item.label}
                        </span>
                        <button
                          onClick={() => deleteMutation.mutate({ id: item.id })}
                          className="opacity-0 group-hover/item:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

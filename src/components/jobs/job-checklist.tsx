"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { CheckSquare, Square, Plus, Trash2, Loader2 } from "lucide-react";

interface Props {
  jobId: string;
}

export function JobChecklist({ jobId }: Props) {
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: items = [], isLoading, refetch } = api.checklist.list.useQuery({ jobId });

  const toggleMutation = api.checklist.toggle.useMutation({ onSuccess: () => refetch() });
  const addMutation = api.checklist.add.useMutation({
    onSuccess: () => { setNewLabel(""); setAdding(false); refetch(); },
  });
  const deleteMutation = api.checklist.delete.useMutation({ onSuccess: () => refetch() });

  const completed = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="bg-white rounded-xl border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <CheckSquare className="h-4 w-4 text-blue-500" />
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
              className="h-full rounded-full transition-all duration-500 bg-blue-500"
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
              if (e.key === "Enter") addMutation.mutate({ jobId, label: newLabel });
              if (e.key === "Escape") { setAdding(false); setNewLabel(""); }
            }}
            placeholder="New checklist item..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => addMutation.mutate({ jobId, label: newLabel })}
            disabled={!newLabel.trim() || addMutation.isPending}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </button>
        </div>
      )}

      {/* Items */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <button
                onClick={() => toggleMutation.mutate({ id: item.id, checked: !item.checked })}
                disabled={toggleMutation.isPending}
                className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
              >
                {item.checked ? (
                  <CheckSquare className="h-4.5 w-4.5 text-blue-500" />
                ) : (
                  <Square className="h-4.5 w-4.5" />
                )}
              </button>
              <span className={`flex-1 text-sm transition-colors ${
                item.checked ? "line-through text-gray-400" : "text-gray-700"
              }`}>
                {item.label}
              </span>
              <button
                onClick={() => deleteMutation.mutate({ id: item.id })}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all rounded"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

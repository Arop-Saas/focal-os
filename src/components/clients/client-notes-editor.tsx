"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/trpc/client";
import { StickyNote, Loader2, Check } from "lucide-react";

interface Props {
  clientId: string;
  initialNotes: string | null;
}

export function ClientNotesEditor({ clientId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateMutation = api.clients.update.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function handleChange(value: string) {
    setNotes(value);
    setSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateMutation.mutate({ id: clientId, notes: value });
    }, 800);
  }

  function handleSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateMutation.mutate({ id: clientId, notes });
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-gray-400" />
          Internal Notes
        </h2>
        <div className="flex items-center gap-2">
          {updateMutation.isPending && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          {saved && !updateMutation.isPending && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Private notes about this client — not visible to the client…"
        rows={4}
        className="w-full resize-none border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <p className="text-[10px] text-gray-400 mt-1.5">Only visible to your team. Auto-saves as you type.</p>
    </div>
  );
}

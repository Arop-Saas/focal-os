"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Users, Plus, Loader2, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

/**
 * Customer-team membership for a client: shows the current team, assigns to
 * an existing team, removes, or creates a new team inline (created teams get
 * this client as their first member).
 */
export function ClientTeamCard({
  clientId,
  currentTeam,
}: {
  clientId: string;
  currentTeam: { id: string; name: string; credits: number } | null;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const teams = trpc.teams.list.useQuery();
  const addMember = trpc.teams.addMember.useMutation({ onSuccess: () => router.refresh() });
  const removeMember = trpc.teams.removeMember.useMutation({ onSuccess: () => router.refresh() });
  const createTeam = trpc.teams.create.useMutation();

  const busy = addMember.isPending || removeMember.isPending || createTeam.isPending;
  const error = addMember.error?.message ?? removeMember.error?.message ?? createTeam.error?.message;

  async function handleCreate() {
    if (newName.trim().length < 1) return;
    const team = await createTeam.mutateAsync({ name: newName.trim() });
    await addMember.mutateAsync({ teamId: team.id, clientId });
    setCreating(false);
    setNewName("");
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Users className="h-4 w-4 text-gray-400" /> Team
        </p>
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
      </div>

      {currentTeam ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{currentTeam.name}</p>
            <p className="text-xs text-gray-500">{formatCurrency(currentTeam.credits)} team credits</p>
          </div>
          <button
            onClick={() => removeMember.mutate({ clientId })}
            disabled={busy}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        </div>
      ) : creating ? (
        <div className="space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Team name — e.g. The Kim Group"
            autoFocus
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={() => setCreating(false)} disabled={busy}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={busy || !newName.trim()}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              Create & add
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {(teams.data ?? []).length > 0 && (
            <select
              defaultValue=""
              disabled={busy}
              onChange={(e) => e.target.value && addMember.mutate({ teamId: e.target.value, clientId })}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Add to a team…</option>
              {(teams.data ?? []).map((t: { id: string; name: string }) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setCreating(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600"
          >
            <Plus className="h-3.5 w-3.5" /> New team
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

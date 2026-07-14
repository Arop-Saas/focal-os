"use client";

/**
 * S6 (A8): Roles — the WorkspaceRole backend shipped in May with ZERO UI.
 * This page finally exposes it: create/delete job-title roles with colors.
 * Assigning a role to a member happens in the member settings screen.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Shield, Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const PRESET_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

export default function TeamRolesPage() {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const utils = trpc.useUtils();

  const rolesQuery = trpc.staff.listRoles.useQuery();
  const createMutation = trpc.staff.createRole.useMutation({
    onSuccess: () => { setName(""); utils.staff.listRoles.invalidate(); },
  });
  const deleteMutation = trpc.staff.deleteRole.useMutation({
    onSuccess: () => utils.staff.listRoles.invalidate(),
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-gray-100 bg-white px-6 py-4 flex items-center gap-3">
        <Link href="/staff" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Shield className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Team Roles</h1>
          <p className="text-xs text-gray-500">Job-title templates with a color — assign them to members in their settings.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {/* Create */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">New role</h2>
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead Photographer, Drone Pilot, Editor"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => name.trim().length >= 2 && createMutation.mutate({ name: name.trim(), color })}
              disabled={createMutation.isPending || name.trim().length < 2}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-gray-900 scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                aria-label={`color ${c}`}
              />
            ))}
          </div>
          {createMutation.error && (
            <p className="text-xs text-red-600 mt-2">{createMutation.error.message}</p>
          )}
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {rolesQuery.isLoading ? (
            <p className="p-5 text-sm text-gray-400">Loading…</p>
          ) : (rolesQuery.data?.length ?? 0) === 0 ? (
            <p className="p-5 text-sm text-gray-400">No roles yet — create your first above.</p>
          ) : (
            rolesQuery.data!.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <span className="flex-1 text-sm font-medium text-gray-800">{r.name}</span>
                <button
                  onClick={() => deleteMutation.mutate({ roleId: r.id })}
                  disabled={deleteMutation.isPending}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  aria-label={`delete ${r.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

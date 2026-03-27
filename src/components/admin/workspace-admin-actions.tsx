"use client";

import { useTransition, useState } from "react";
import { setWorkspaceStatus, extendTrial, deleteWorkspace } from "@/app/admin/workspaces/[id]/actions";
import { ShieldAlert, Play, Pause, RefreshCw, Clock, Trash2 } from "lucide-react";

type Status = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "PAUSED";

interface Props {
  workspaceId: string;
  currentStatus: Status;
  workspaceName: string;
}

export function WorkspaceAdminActions({ workspaceId, currentStatus, workspaceName }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [showDeleteZone, setShowDeleteZone] = useState(false);

  function run(action: () => Promise<void>, label: string) {
    if (confirm !== label) {
      setConfirm(label);
      return;
    }
    setConfirm(null);
    startTransition(async () => {
      await action();
    });
  }

  const btn =
    "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold tracking-wide uppercase transition-all disabled:opacity-40 border";

  return (
    <div className="bg-[#0d0d1a] rounded-xl border border-violet-500/20 p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="h-3.5 w-3.5 text-violet-400" />
        <p className="text-[10px] font-bold tracking-widest uppercase text-violet-400">
          Operator Controls
        </p>
      </div>

      {/* Status overrides */}
      <div className="mb-4">
        <p className="text-[9px] font-bold tracking-widest uppercase text-slate-600 mb-2">
          Subscription Status
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={pending || currentStatus === "ACTIVE"}
            onClick={() => run(() => setWorkspaceStatus(workspaceId, "ACTIVE"), "activate")}
            className={`${btn} ${
              confirm === "activate"
                ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-300"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:border-emerald-400/40"
            } disabled:cursor-not-allowed`}
          >
            <Play className="h-3 w-3" />
            {confirm === "activate" ? "Confirm?" : "Activate"}
          </button>

          <button
            disabled={pending || currentStatus === "PAUSED"}
            onClick={() => run(() => setWorkspaceStatus(workspaceId, "PAUSED"), "suspend")}
            className={`${btn} ${
              confirm === "suspend"
                ? "bg-amber-500/20 border-amber-400/60 text-amber-300"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:border-amber-400/40"
            } disabled:cursor-not-allowed`}
          >
            <Pause className="h-3 w-3" />
            {confirm === "suspend" ? "Confirm?" : "Suspend"}
          </button>

          <button
            disabled={pending || currentStatus === "TRIALING"}
            onClick={() => run(() => setWorkspaceStatus(workspaceId, "TRIALING"), "trial")}
            className={`${btn} ${
              confirm === "trial"
                ? "bg-violet-500/20 border-violet-400/60 text-violet-300"
                : "bg-violet-500/10 border-violet-500/20 text-violet-400 hover:border-violet-400/40"
            } disabled:cursor-not-allowed`}
          >
            <RefreshCw className="h-3 w-3" />
            {confirm === "trial" ? "Confirm?" : "Set Trialing"}
          </button>

          <button
            disabled={pending || currentStatus === "CANCELED"}
            onClick={() => run(() => setWorkspaceStatus(workspaceId, "CANCELED"), "cancel")}
            className={`${btn} ${
              confirm === "cancel"
                ? "bg-red-500/20 border-red-400/60 text-red-300"
                : "bg-red-500/10 border-red-500/20 text-red-400 hover:border-red-400/40"
            } disabled:cursor-not-allowed`}
          >
            {confirm === "cancel" ? "Confirm?" : "Cancel Sub"}
          </button>
        </div>
        {confirm && (
          <p className="text-[10px] text-amber-400 mt-2 font-mono">
            ⚠ Click again to confirm. This takes effect immediately.
          </p>
        )}
      </div>

      {/* Trial extension */}
      <div>
        <p className="text-[9px] font-bold tracking-widest uppercase text-slate-600 mb-2">
          Extend Trial
        </p>
        <div className="flex gap-2">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await extendTrial(workspaceId, days);
                })
              }
              className={`${btn} bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:border-cyan-400/40 disabled:opacity-40`}
            >
              <Clock className="h-3 w-3" />
              +{days}d
            </button>
          ))}
        </div>
      </div>

      {pending && (
        <p className="text-[10px] text-violet-400 mt-3 font-mono animate-pulse">
          Applying changes…
        </p>
      )}

      {/* Danger Zone */}
      <div className="mt-5 pt-5 border-t border-red-500/20">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-bold tracking-widest uppercase text-red-600">
            Danger Zone
          </p>
          <button
            onClick={() => { setShowDeleteZone((v) => !v); setDeleteInput(""); }}
            className="text-[9px] font-bold tracking-widest uppercase text-red-600 hover:text-red-400 transition-colors"
          >
            {showDeleteZone ? "Cancel" : "Delete Workspace"}
          </button>
        </div>

        {showDeleteZone && (
          <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-4 space-y-3">
            <p className="text-[11px] text-red-400 leading-relaxed">
              This will <span className="font-bold">permanently delete</span> all jobs, clients, invoices, galleries, staff, and members. This cannot be undone.
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              Type <span className="text-red-400 font-bold">{workspaceName}</span> to confirm
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={workspaceName}
              className="w-full bg-black/40 border border-red-500/30 rounded px-3 py-1.5 text-xs text-red-200 font-mono placeholder:text-slate-700 focus:outline-none focus:border-red-400/60"
            />
            <button
              disabled={pending || deleteInput !== workspaceName}
              onClick={() =>
                startTransition(async () => {
                  await deleteWorkspace(workspaceId);
                })
              }
              className="flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded text-[11px] font-bold tracking-wide uppercase transition-all border bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30 hover:border-red-400/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3 w-3" />
              {pending ? "Deleting…" : "Delete Workspace Forever"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

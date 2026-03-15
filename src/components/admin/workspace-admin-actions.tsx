"use client";

import { useTransition, useState } from "react";
import { setWorkspaceStatus, extendTrial } from "@/app/admin/workspaces/[id]/actions";
import { ShieldAlert, Play, Pause, RefreshCw, Clock } from "lucide-react";

type Status = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "PAUSED";

interface Props {
  workspaceId: string;
  currentStatus: Status;
}

export function WorkspaceAdminActions({ workspaceId, currentStatus }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);

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
    </div>
  );
}

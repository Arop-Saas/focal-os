"use client";

import { useTransition } from "react";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";
import { exitImpersonation } from "@/app/admin/workspaces/[id]/actions";

export function ImpersonationBanner({ workspaceName }: { workspaceName: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 bg-violet-600 px-4 py-2 text-white text-xs font-mono shrink-0">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-bold">OPERATOR MODE</span> — viewing as{" "}
          <span className="font-bold">{workspaceName}</span>. Actions you take affect this real workspace.
        </span>
      </div>
      <button
        onClick={() => startTransition(() => exitImpersonation())}
        disabled={pending}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wide transition-colors shrink-0"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
        Exit
      </button>
    </div>
  );
}

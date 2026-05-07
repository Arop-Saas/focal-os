"use client";

import { useTransition } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { impersonateWorkspace } from "@/app/admin/workspaces/[id]/actions";

export function ImpersonateButton({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Enter workspace "${workspaceName}" as an operator? You will see the app as their owner.`)) return;
    startTransition(() => impersonateWorkspace(workspaceId));
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold tracking-wide uppercase rounded-lg transition-colors"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
      {pending ? "Entering…" : "Impersonate"}
    </button>
  );
}

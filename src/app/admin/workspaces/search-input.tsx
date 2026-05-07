"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useCallback, useRef } from "react";

export function WorkspaceSearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const inputRef = useRef<HTMLInputElement>(null);

  const push = useCallback(
    (value: string) => {
      const params = new URLSearchParams();
      if (value) params.set("q", value);
      if (status) params.set("status", status);
      router.push(`/admin/workspaces?${params.toString()}`);
    },
    [router, status]
  );

  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        defaultValue={q}
        placeholder="Search name, slug, email…"
        onChange={(e) => push(e.target.value)}
        className="w-full bg-[#0d0d1a] border border-[#ffffff10] rounded-lg pl-8 pr-8 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors font-mono"
      />
      {q && (
        <button
          onClick={() => { push(""); if (inputRef.current) inputRef.current.value = ""; }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

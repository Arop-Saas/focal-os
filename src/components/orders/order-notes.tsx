"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Typed internal order notes (JobNote — notes taxonomy from
 * docs/orders-architecture.md). Lives on the Messages tab next to the
 * client-facing thread so team-only context never leaks to the customer.
 */

const KIND_META: Record<string, { label: string; cls: string }> = {
  CUSTOMER_INSTRUCTIONS: { label: "Customer", cls: "border-blue-200 bg-blue-50 text-blue-700" },
  INTERNAL:              { label: "Internal", cls: "border-gray-200 bg-gray-100 text-gray-600" },
  FIELD:                 { label: "Field",    cls: "border-violet-200 bg-violet-50 text-violet-700" },
  EDITOR:                { label: "Editor",   cls: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  QA_REVISION:           { label: "QA",       cls: "border-amber-200 bg-amber-50 text-amber-700" },
};

const KIND_KEYS = ["INTERNAL", "FIELD", "EDITOR", "QA_REVISION", "CUSTOMER_INSTRUCTIONS"] as const;

export interface OrderNoteRow {
  id: string;
  kind: string;
  body: string;
  authorName: string | null;
  whenLabel: string;
}

export function OrderNotes({ jobId, notes }: { jobId: string; notes: OrderNoteRow[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof KIND_KEYS)[number]>("INTERNAL");
  const [body, setBody] = useState("");

  const addNote = trpc.jobs.addNote.useMutation({
    onSuccess: () => {
      setBody("");
      router.refresh();
    },
  });

  const submit = () => {
    if (!body.trim() || addNote.isPending) return;
    addNote.mutate({ jobId, kind, body: body.trim() });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-[13px] font-semibold text-gray-900">Order notes</h2>

      {/* Composer */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/50 p-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {KIND_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                kind === k ? KIND_META[k].cls : "border-gray-200 bg-white text-gray-400 hover:text-gray-600"
              )}
            >
              {KIND_META[k].label}
            </button>
          ))}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder={
            kind === "CUSTOMER_INSTRUCTIONS"
              ? "Instructions from the customer…"
              : kind === "EDITOR"
              ? "Instructions for the editor…"
              : "Add a team note…"
          }
          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none"
        />
        <div className="mt-1.5 flex justify-end">
          <button
            onClick={submit}
            disabled={!body.trim() || addNote.isPending}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
          >
            {addNote.isPending ? "Adding…" : "Add note"}
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-[12px] text-gray-400">No notes yet. Notes are team-only.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const meta = KIND_META[n.kind] ?? KIND_META.INTERNAL;
            return (
              <div key={n.id} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.cls)}>
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {n.authorName ?? "System"} · {n.whenLabel}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">{n.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

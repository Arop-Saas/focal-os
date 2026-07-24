"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar, Check, Loader2, Plus, User } from "lucide-react";

/**
 * Team tasks attached to this order — the order-side view of
 * Collaboration → Tasks. Quick-add creates tasks pre-attached to the order.
 */

export function TeamTasksCard({ jobId }: { jobId: string }) {
  const utils = trpc.useUtils();
  const tasks = trpc.tasks.list.useQuery({ jobId, doneLimit: 10 });
  const [title, setTitle] = useState("");

  const refresh = () => utils.tasks.list.invalidate();
  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      setTitle("");
      refresh();
    },
  });
  const toggle = trpc.tasks.toggle.useMutation({ onSuccess: refresh });

  const submit = () => {
    if (!title.trim() || create.isPending) return;
    create.mutate({ title: title.trim(), jobId });
  };

  const open = tasks.data?.open ?? [];
  const done = tasks.data?.done ?? [];
  const now = Date.now();

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-gray-900">Team tasks</h2>
        <span className="text-[11px] text-gray-400">
          {open.length === 0 ? "None open" : `${open.length} open`}
        </span>
      </div>

      <div className="mb-3 flex items-center gap-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Add a task for this order…"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[12px] focus:border-blue-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || create.isPending}
          className="rounded-lg bg-gray-900 p-2 text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          aria-label="Add task"
        >
          {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>

      {tasks.isLoading ? (
        <p className="py-2 text-[12px] text-gray-400">Loading…</p>
      ) : open.length === 0 && done.length === 0 ? (
        <p className="text-[12px] text-gray-400">
          No team tasks for this order. Tasks also appear in Collaboration → Tasks.
        </p>
      ) : (
        <div className="space-y-1.5">
          {open.map((t) => {
            const overdue = t.dueAt != null && new Date(t.dueAt).getTime() < now;
            return (
              <div key={t.id} className="flex items-start gap-2.5 py-1">
                <button
                  type="button"
                  onClick={() => toggle.mutate({ taskId: t.id, done: true })}
                  disabled={toggle.isPending}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 transition-colors hover:border-blue-500 hover:bg-blue-50"
                  aria-label="Mark done"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-gray-800">{t.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                    {t.assignee && (
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {t.assignee.fullName}</span>
                    )}
                    {t.dueAt && (
                      <span className={cn("flex items-center gap-1", overdue && "font-medium text-red-600")}>
                        <Calendar className="h-3 w-3" /> {format(new Date(t.dueAt), "MMM d")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {done.map((t) => (
            <div key={t.id} className="flex items-start gap-2.5 py-1 opacity-60">
              <button
                type="button"
                onClick={() => toggle.mutate({ taskId: t.id, done: false })}
                disabled={toggle.isPending}
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700"
                aria-label="Mark not done"
              >
                <Check className="h-2.5 w-2.5" />
              </button>
              <p className="min-w-0 flex-1 text-[13px] leading-snug text-gray-400 line-through">{t.title}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

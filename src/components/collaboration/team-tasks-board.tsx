"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar, Check, Link2, Loader2, Plus, Search, Trash2, User, X } from "lucide-react";

/**
 * Collaboration → Tasks: team to-dos with checkboxes, optionally attached to
 * an order (searchable by order #, address or client name). Backed by the
 * tasks router; TeamTask model.
 */

type OrderRef = {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  propertyCity?: string;
  client?: { firstName: string; lastName: string } | null;
};

function dueDate(value: string): Date {
  // Noon UTC keeps the picked calendar day stable across timezones
  return new Date(`${value}T12:00:00Z`);
}

function OrderChip({ job }: { job: { id: string; jobNumber: string; propertyAddress: string } }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="inline-flex max-w-[240px] items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-100"
    >
      <Link2 className="h-3 w-3 shrink-0" />
      <span className="truncate">#{job.jobNumber} · {job.propertyAddress}</span>
    </Link>
  );
}

/** Search popover for attaching an order */
function OrderPicker({
  selected,
  onSelect,
}: {
  selected: OrderRef | null;
  onSelect: (o: OrderRef | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const results = trpc.tasks.searchOrders.useQuery(
    { search },
    { enabled: open && search.trim().length >= 1, placeholderData: (prev) => prev }
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700">
        #{selected.jobNumber} · <span className="max-w-[160px] truncate">{selected.propertyAddress}</span>
        <button type="button" onClick={() => onSelect(null)} className="ml-0.5 text-blue-400 hover:text-blue-700">
          <X className="h-3 w-3" />
        </button>
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
      >
        <Link2 className="h-3.5 w-3.5" /> Attach order
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order #, address or client…"
              className="flex-1 text-sm outline-none placeholder:text-gray-400"
            />
            {results.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-300" />}
          </div>
          <div className="max-h-56 overflow-y-auto">
            {!search.trim() ? (
              <p className="py-4 text-center text-xs text-gray-400">Type to search your orders.</p>
            ) : results.data && results.data.length > 0 ? (
              results.data.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => {
                    onSelect(j);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-800">{j.propertyAddress}</p>
                    <p className="text-xs text-gray-400">
                      #{j.jobNumber}
                      {j.client && <> · {j.client.firstName} {j.client.lastName}</>}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <p className="py-4 text-center text-xs text-gray-400">{results.isFetching ? "Searching…" : "No matching orders"}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamTasksBoard() {
  const utils = trpc.useUtils();
  const tasks = trpc.tasks.list.useQuery({});
  const members = trpc.tasks.teamMembers.useQuery();

  const [title, setTitle] = useState("");
  const [attachedOrder, setAttachedOrder] = useState<OrderRef | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [due, setDue] = useState("");
  const [showDone, setShowDone] = useState(false);

  const refresh = () => utils.tasks.list.invalidate();
  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      setTitle("");
      setAttachedOrder(null);
      setAssigneeId("");
      setDue("");
      refresh();
    },
  });
  const toggle = trpc.tasks.toggle.useMutation({ onSuccess: refresh });
  const remove = trpc.tasks.delete.useMutation({ onSuccess: refresh });

  const submit = () => {
    if (!title.trim() || create.isPending) return;
    create.mutate({
      title: title.trim(),
      jobId: attachedOrder?.id ?? null,
      assignedUserId: assigneeId || null,
      dueAt: due ? dueDate(due) : null,
    });
  };

  const open = tasks.data?.open ?? [];
  const done = tasks.data?.done ?? [];
  const now = Date.now();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      {/* Composer */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Add a task for the team…"
            className="flex-1 rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || create.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <OrderPicker selected={attachedOrder} onSelect={setAttachedOrder} />
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5">
            <User className="h-3.5 w-3.5 text-gray-400" />
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="bg-transparent text-xs font-medium text-gray-600 outline-none"
            >
              <option value="">Anyone</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.fullName}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="bg-transparent text-xs font-medium text-gray-600 outline-none"
            />
          </div>
        </div>
        {create.error && <p className="mt-2 text-xs text-red-600">{create.error.message}</p>}
      </div>

      {/* Open tasks */}
      {tasks.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
      ) : open.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm font-medium text-gray-500">No open tasks</p>
          <p className="mt-1 text-xs text-gray-400">Add one above — attach an order so it shows on that order&apos;s page too.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {open.map((t) => {
            const overdue = t.dueAt != null && new Date(t.dueAt).getTime() < now;
            return (
              <div
                key={t.id}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 transition-colors hover:border-gray-300"
              >
                <button
                  type="button"
                  onClick={() => toggle.mutate({ taskId: t.id, done: true })}
                  disabled={toggle.isPending}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 transition-colors hover:border-blue-500 hover:bg-blue-50"
                  aria-label="Mark done"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800">{t.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                    {t.job && <OrderChip job={t.job} />}
                    {t.assignee && (
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {t.assignee.fullName}</span>
                    )}
                    {t.dueAt && (
                      <span className={cn("flex items-center gap-1", overdue && "font-medium text-red-600")}>
                        <Calendar className="h-3 w-3" /> {format(new Date(t.dueAt), "MMM d")}
                      </span>
                    )}
                    {t.createdBy && <span>added by {t.createdBy.fullName}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate({ taskId: t.id })}
                  className="shrink-0 rounded p-1 text-gray-200 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                  aria-label="Delete task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed */}
      {done.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 transition-colors hover:text-gray-600"
          >
            Completed ({done.length}) {showDone ? "▾" : "▸"}
          </button>
          {showDone && (
            <div className="space-y-1.5">
              {done.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3.5 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggle.mutate({ taskId: t.id, done: false })}
                    disabled={toggle.isPending}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700"
                    aria-label="Mark not done"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-400 line-through">{t.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-300">
                      {t.job && <span>#{t.job.jobNumber}</span>}
                      {t.completedAt && <span>done {format(new Date(t.completedAt), "MMM d, h:mm a")}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

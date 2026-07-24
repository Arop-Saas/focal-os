"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Loader2, Plus } from "lucide-react";
import { PRODUCTION_TASK_TYPE_LABELS } from "./status-meta";

/**
 * Inline "Add task" form for the order's production pipeline. Catalog items
 * generate most tasks automatically; this covers one-off or manual work.
 */

const TYPE_KEYS = ["PHOTO_EDITING", "VIDEO_EDITING", "FLOOR_PLAN", "VIRTUAL_TOUR", "QA", "OTHER"] as const;

export interface StaffOption {
  id: string;
  name: string;
}

export function AddProductionTask({ jobId, staff }: { jobId: string; staff: StaffOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof TYPE_KEYS)[number]>("OTHER");
  const [assigneeStaffId, setAssigneeStaffId] = useState("");
  const [due, setDue] = useState("");

  const create = trpc.jobs.createProductionTask.useMutation({
    onSuccess: () => {
      setTitle("");
      setType("OTHER");
      setAssigneeStaffId("");
      setDue("");
      setOpen(false);
      router.refresh();
    },
  });

  const submit = () => {
    if (!title.trim() || create.isPending) return;
    create.mutate({
      jobId,
      title: title.trim(),
      type,
      assigneeStaffId: assigneeStaffId || null,
      dueAt: due ? new Date(`${due}T12:00:00Z`) : null,
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-blue-600 transition-colors hover:text-blue-700"
      >
        <Plus className="h-3.5 w-3.5" /> Add task
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="Task title — e.g. Blue-sky replacement"
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as (typeof TYPE_KEYS)[number])}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none"
        >
          {TYPE_KEYS.map((k) => (
            <option key={k} value={k}>{PRODUCTION_TASK_TYPE_LABELS[k]}</option>
          ))}
        </select>
        <select
          value={assigneeStaffId}
          onChange={(e) => setAssigneeStaffId(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none"
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none"
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || create.isPending}
            className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {create.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Add task
          </button>
        </div>
      </div>
      {create.error && <p className="mt-1.5 text-xs text-red-600">{create.error.message}</p>}
    </div>
  );
}

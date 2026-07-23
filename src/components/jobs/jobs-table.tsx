"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, formatDateTime, formatCurrency, JOB_STATUS_COLORS, JOB_STATUS_LABELS } from "@/lib/utils";
import { MapPin, Calendar, User, ChevronLeft, ChevronRight, Trash2, Loader2, AlertTriangle, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

type Job = {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  scheduledAt: Date | null;
  status: string;
  totalAmount: number;
  isRush: boolean;
  client: { id: string; firstName: string; lastName: string; email: string };
  package: { name: string } | null;
  assignments: {
    staff: { member: { user: { fullName: string } } };
  }[];
  invoice: { status: string; totalAmount: number } | null;
};

interface JobsTableProps {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
}

export function JobsTable({ jobs, total, page, limit }: JobsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / limit);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const bulkDelete = trpc.jobs.bulkDelete.useMutation({
    onSuccess: (data) => {
      setSelectedIds(new Set());
      setShowBulkConfirm(false);
      router.refresh();
    },
  });

  const allSelected = jobs.length > 0 && jobs.every((j) => selectedIds.has(j.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(jobs.map((j) => j.id)));
    }
  }

  function changePage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    setSelectedIds(new Set());
    router.push(`?${params.toString()}`);
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-base font-semibold text-gray-700">No orders found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try changing your filters or create a new job.
        </p>
        <Link
          href="/jobs/new"
          className="mt-4 text-sm font-medium text-blue-600 hover:underline"
        >
          + Create your first job
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">

      {/* ── Mobile card list (hidden on sm+) ───────────────────────────── */}
      <div className="sm:hidden divide-y">
        {jobs.map((job) => {
          const photographer = job.assignments[0]?.staff.member.user.fullName;
          return (
            <div
              key={job.id}
              className="px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => router.push(`/jobs/${job.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="pt-0.5 shrink-0"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleSelect(job.id); }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(job.id)}
                    readOnly
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {job.isRush && (
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                        RUSH
                      </span>
                    )}
                    <p className="font-semibold text-gray-900 text-sm truncate">{job.propertyAddress}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {job.propertyCity}, {job.propertyState}
                    <span className="text-gray-300 mx-1">·</span>
                    #{job.jobNumber}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {job.client.firstName} {job.client.lastName}
                    {photographer && <> · {photographer}</>}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={cn(
                    "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border",
                    JOB_STATUS_COLORS[job.status]
                  )}>
                    {JOB_STATUS_LABELS[job.status]}
                  </span>
                  <p className="text-xs font-semibold text-gray-900">{formatCurrency(job.totalAmount)}</p>
                </div>
              </div>
              {job.scheduledAt && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                  <Calendar className="h-3 w-3" />
                  {new Date(job.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" · "}
                  {new Date(job.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Desktop table (hidden on mobile) ───────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="w-10 px-4 py-3 cursor-pointer" onClick={toggleAll}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  readOnly
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Order</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Client</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Scheduled</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Photographer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.map((job) => {
              const photographer = job.assignments[0]?.staff.member.user.fullName;
              return (
                <tr
                  key={job.id}
                  className={cn(
                    "hover:bg-gray-50 cursor-pointer transition-colors",
                    selectedIds.has(job.id) && "bg-blue-50 hover:bg-blue-50/80"
                  )}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                >
                  <td
                    className="w-10 px-4 py-3.5"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleSelect(job.id); }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(job.id)}
                      readOnly
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-start gap-2">
                      {job.isRush && (
                        <span className="shrink-0 mt-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                          RUSH
                        </span>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{job.propertyAddress}</p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" />
                          {job.propertyCity}, {job.propertyState}
                          <span className="text-gray-300 mx-1">·</span>
                          #{job.jobNumber}
                        </p>
                        {job.package && (
                          <p className="text-xs text-blue-600 mt-0.5">{job.package.name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-gray-800">
                      {job.client.firstName} {job.client.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{job.client.email}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    {job.scheduledAt ? (
                      <div>
                        <p className="font-medium text-gray-800">
                          {new Date(job.scheduledAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(job.scheduledAt).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">Unscheduled</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {photographer ? (
                      <span className="text-gray-700">{photographer}</span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border",
                        JOB_STATUS_COLORS[job.status]
                      )}
                    >
                      {JOB_STATUS_LABELS[job.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <p className="font-medium text-gray-900">
                      {formatCurrency(job.totalAmount)}
                    </p>
                    {job.invoice && (
                      <p className={cn(
                        "text-[10px] uppercase font-semibold mt-0.5",
                        job.invoice.status === "PAID" ? "text-green-600" :
                        job.invoice.status === "OVERDUE" ? "text-red-600" : "text-gray-400"
                      )}>
                        {job.invoice.status}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page === 1}
              className="flex items-center justify-center h-7 w-7 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs font-medium text-gray-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => changePage(page + 1)}
              disabled={page === totalPages}
              className="flex items-center justify-center h-7 w-7 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk action bar ──────────────────────────────────────────── */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white pl-4 pr-3 py-2.5 rounded-xl shadow-2xl">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <button
            onClick={() => setShowBulkConfirm(true)}
            className="flex items-center gap-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="flex items-center justify-center h-7 w-7 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Bulk delete confirmation modal ────────────────────────────── */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete {selectedIds.size} Jobs</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete {selectedIds.size} job{selectedIds.size > 1 ? "s" : ""} and all
              associated data including invoices, galleries, messages, and assignments.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkConfirm(false)}
                disabled={bulkDelete.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => bulkDelete.mutate({ ids: Array.from(selectedIds) })}
                disabled={bulkDelete.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {bulkDelete.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

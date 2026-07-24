"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, formatCurrency, formatOrderNumber } from "@/lib/utils";
import { ORDER_STAGE_COLORS, ORDER_STAGE_LABELS, type OrderStage } from "@/lib/orders/stage";
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Loader2, MapPin, Trash2, X,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { OrderViewKey } from "./order-views";

export interface OrderRow {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  scheduledAt: string | null;
  clientName: string;
  clientCompany: string | null;
  photographer: string | null;
  services: string[];
  stage: OrderStage;
  nextAction: string;
  attention: string[];
  invoiceStatus: string | null;
  totalAmount: number;
}

const EMPTY_COPY: Partial<Record<OrderViewKey, { title: string; sub: string }>> = {
  needs_attention: { title: "All clear", sub: "Nothing needs your attention right now." },
  today:           { title: "No shoots today", sub: "Today's schedule is empty." },
  upcoming:        { title: "Nothing upcoming", sub: "No future shoots on the books yet." },
  unscheduled:     { title: "Nothing unscheduled", sub: "Every order has a shoot time." },
  production:      { title: "Nothing in production", sub: "No orders are being edited right now." },
  qa:              { title: "Quality check queue is empty", sub: "Nothing is waiting for review." },
  unpaid:          { title: "No unpaid invoices", sub: "Everything billed has been paid." },
  delivered:       { title: "Nothing delivered yet", sub: "Delivered orders will appear here." },
  cancelled:       { title: "No cancelled orders", sub: "" },
};

function paymentBadge(status: string | null): { label: string; cls: string } {
  switch (status) {
    case "PAID":    return { label: "Paid",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "OVERDUE": return { label: "Overdue", cls: "bg-red-50 text-red-700 border-red-200" };
    case "PARTIAL": return { label: "Partial", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "SENT":
    case "VIEWED":  return { label: "Due",     cls: "bg-gray-50 text-gray-600 border-gray-200" };
    case "DRAFT":   return { label: "Draft",   cls: "bg-gray-50 text-gray-500 border-gray-200" };
    case "VOID":
    case "UNCOLLECTIBLE": return { label: "Void", cls: "bg-gray-50 text-gray-400 border-gray-200" };
    default:        return { label: "Unbilled", cls: "bg-gray-50 text-gray-400 border-gray-200" };
  }
}

function fmtDay(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });
}
function fmtTime(iso: string, tz: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
}

export function OrdersTable({ rows, total, page, limit, view, timezone }: {
  rows: OrderRow[];
  total: number;
  page: number;
  limit: number;
  view: OrderViewKey;
  timezone: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const bulkDelete = trpc.jobs.bulkDelete.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      setShowBulkConfirm(false);
      router.refresh();
    },
  });

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function changePage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    setSelectedIds(new Set());
    router.push(`?${params.toString()}`);
  }

  if (rows.length === 0) {
    const copy = EMPTY_COPY[view] ?? { title: "No orders found", sub: "Try a different view or search." };
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-16 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>
        <p className="text-base font-semibold text-gray-800">{copy.title}</p>
        {copy.sub && <p className="mt-1 text-sm text-gray-400">{copy.sub}</p>}
        <Link href="/jobs/new" className="mt-4 text-sm font-medium text-blue-600 hover:underline">
          + New order
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {/* ── Mobile cards ── */}
      <div className="divide-y sm:hidden">
        {rows.map((r) => (
          <div
            key={r.id}
            className="cursor-pointer px-4 py-3.5 transition-colors hover:bg-gray-50"
            onClick={() => router.push(`/jobs/${r.id}`)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{r.propertyAddress}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  {r.propertyCity}, {r.propertyState}
                  <span className="mx-1 text-gray-300">·</span>#{formatOrderNumber(r.jobNumber)}
                </p>
                <p className="mt-1 text-xs text-gray-500">{r.clientName}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", ORDER_STAGE_COLORS[r.stage])}>
                  {ORDER_STAGE_LABELS[r.stage]}
                </span>
                <p className="text-xs font-semibold text-gray-900">{formatCurrency(r.totalAmount)}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-400">
                {r.scheduledAt ? `${fmtDay(r.scheduledAt, timezone)} · ${fmtTime(r.scheduledAt, timezone)}` : "Unscheduled"}
              </span>
              <span className={cn("flex items-center gap-1 font-medium", r.attention.length ? "text-amber-600" : "text-gray-400")}>
                {r.attention.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                {r.nextAction}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-gray-50/95 backdrop-blur">
              <th className="w-10 cursor-pointer px-4 py-2.5" onClick={() => setSelectedIds(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}>
                <input type="checkbox" checked={allSelected} readOnly
                  className="pointer-events-none h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600" />
              </th>
              {["Property", "Customer", "Appointment", "Assigned", "Services", "Stage", "Total", "Next action"].map((h, i) => (
                <th key={h} className={cn(
                  "px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400",
                  i === 6 ? "text-right" : "text-left",
                  h === "Services" && "hidden xl:table-cell"
                )}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => {
              const pay = paymentBadge(r.invoiceStatus);
              const quiet = r.stage === "CLOSED" || r.stage === "CANCELLED" || r.stage === "DELIVERED";
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-gray-50",
                    selectedIds.has(r.id) && "bg-blue-50 hover:bg-blue-50/80",
                    quiet && "opacity-70"
                  )}
                  onClick={() => router.push(`/jobs/${r.id}`)}
                >
                  <td className="w-10 px-4 py-3" onClick={(e) => { e.stopPropagation(); toggleSelect(r.id); }}>
                    <input type="checkbox" checked={selectedIds.has(r.id)} readOnly
                      className="pointer-events-none h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600" />
                  </td>
                  <td className="min-w-[170px] max-w-[220px] px-2.5 py-3">
                    <p className="truncate text-[13px] font-semibold text-gray-900">{r.propertyAddress}</p>
                    <p className="mt-0.5 truncate text-[11px] text-gray-400">
                      {r.propertyCity}, {r.propertyState} · #{formatOrderNumber(r.jobNumber)}
                    </p>
                  </td>
                  <td className="max-w-[150px] px-2.5 py-3">
                    <p className="truncate text-[13px] text-gray-800">{r.clientName}</p>
                    {r.clientCompany && <p className="mt-0.5 truncate text-[11px] text-gray-400">{r.clientCompany}</p>}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3">
                    {r.scheduledAt ? (
                      <>
                        <p className="text-[13px] text-gray-800">{fmtDay(r.scheduledAt, timezone)}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">{fmtTime(r.scheduledAt, timezone)}</p>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> Unscheduled
                      </span>
                    )}
                  </td>
                  <td className="max-w-[120px] whitespace-nowrap px-2.5 py-3">
                    {r.photographer ? (
                      <span className="truncate text-[13px] text-gray-700">{r.photographer}</span>
                    ) : (
                      <span className="text-[12px] italic text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="hidden max-w-[150px] px-2.5 py-3 xl:table-cell">
                    {r.services.length === 0 ? (
                      <span className="text-[12px] text-gray-300">—</span>
                    ) : (
                      <p className="truncate text-[12px] text-gray-600">
                        {r.services.slice(0, 2).join(" · ")}
                        {r.services.length > 2 && (
                          <span className="text-gray-400"> +{r.services.length - 2}</span>
                        )}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3">
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", ORDER_STAGE_COLORS[r.stage])}>
                      {ORDER_STAGE_LABELS[r.stage]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3 text-right">
                    <p className="text-[13px] font-medium text-gray-900">{formatCurrency(r.totalAmount)}</p>
                    <span className={cn("mt-0.5 inline-flex rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide", pay.cls)}>
                      {pay.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-[12px] font-medium",
                        r.attention.length ? "text-amber-700" : "text-gray-400"
                      )}
                      title={r.attention.join(" · ") || undefined}
                    >
                      {r.attention.length > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
                      {r.nextAction}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => changePage(page - 1)} disabled={page === 1}
              className="flex h-7 w-7 items-center justify-center rounded border text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs font-medium text-gray-700">{page} / {totalPages}</span>
            <button onClick={() => changePage(page + 1)} disabled={page === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded border text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-gray-900 py-2.5 pl-4 pr-3 text-white shadow-2xl">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <button onClick={() => setShowBulkConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-700">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Bulk delete confirm */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete {selectedIds.size} order{selectedIds.size > 1 ? "s" : ""}</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              This permanently deletes the selected order{selectedIds.size > 1 ? "s" : ""} and all associated
              data — invoices, galleries, messages, and assignments.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkConfirm(false)} disabled={bulkDelete.isPending}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={() => bulkDelete.mutate({ ids: Array.from(selectedIds) })} disabled={bulkDelete.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60">
                {bulkDelete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

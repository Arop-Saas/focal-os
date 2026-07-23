"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, ArrowUpDown, SlidersHorizontal, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORDER_STAGE_LABELS, type OrderStage } from "@/lib/orders/stage";

const SORT_OPTIONS = [
  { value: "scheduled_desc", label: "Scheduled: Newest" },
  { value: "scheduled_asc", label: "Scheduled: Oldest" },
  { value: "created_desc", label: "Created: Newest" },
  { value: "created_asc", label: "Created: Oldest" },
];

const PAYMENT_OPTIONS = [
  { value: "UNBILLED", label: "Unbilled" },
  { value: "DRAFT",    label: "Draft" },
  { value: "DUE",      label: "Due" },
  { value: "PARTIAL",  label: "Partially paid" },
  { value: "PAID",     label: "Paid" },
  { value: "OVERDUE",  label: "Overdue" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const STAGE_OPTIONS = (Object.keys(ORDER_STAGE_LABELS) as OrderStage[]).map((s) => ({
  value: s,
  label: ORDER_STAGE_LABELS[s],
}));

export interface OrderFilterValues {
  stage?: string;
  pay?: string;
  staffId?: string;
  serviceId?: string;
  priority?: string;
  schedFrom?: string;
  schedTo?: string;
  createdFrom?: string;
  createdTo?: string;
}

export const ORDER_FILTER_KEYS: (keyof OrderFilterValues)[] = [
  "stage", "pay", "staffId", "serviceId", "priority", "schedFrom", "schedTo", "createdFrom", "createdTo",
];

interface JobFiltersProps {
  currentSearch?: string;
  currentSort?: string;
  filters: OrderFilterValues;
  staffOptions: { id: string; name: string }[];
  serviceOptions: { id: string; name: string }[];
}

const selectClass =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
const dateClass =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</label>
      {children}
    </div>
  );
}

export function JobFilters({ currentSearch, currentSort, filters, staffOptions, serviceOptions }: JobFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // One removable chip per active filter (date ranges collapse into one chip)
  const chips: { key: string; label: string; clear: Record<string, undefined> }[] = [];
  if (filters.stage) chips.push({ key: "stage", label: `Stage: ${ORDER_STAGE_LABELS[filters.stage as OrderStage] ?? filters.stage}`, clear: { stage: undefined } });
  if (filters.pay) chips.push({ key: "pay", label: `Payment: ${PAYMENT_OPTIONS.find((o) => o.value === filters.pay)?.label ?? filters.pay}`, clear: { pay: undefined } });
  if (filters.staffId) chips.push({ key: "staffId", label: `Photographer: ${staffOptions.find((s) => s.id === filters.staffId)?.name ?? "…"}`, clear: { staffId: undefined } });
  if (filters.serviceId) chips.push({ key: "serviceId", label: `Service: ${serviceOptions.find((s) => s.id === filters.serviceId)?.name ?? "…"}`, clear: { serviceId: undefined } });
  if (filters.priority) chips.push({ key: "priority", label: `Priority: ${PRIORITY_OPTIONS.find((o) => o.value === filters.priority)?.label ?? filters.priority}`, clear: { priority: undefined } });
  if (filters.schedFrom || filters.schedTo)
    chips.push({ key: "sched", label: `Scheduled: ${filters.schedFrom ?? "…"} → ${filters.schedTo ?? "…"}`, clear: { schedFrom: undefined, schedTo: undefined } });
  if (filters.createdFrom || filters.createdTo)
    chips.push({ key: "created", label: `Created: ${filters.createdFrom ?? "…"} → ${filters.createdTo ?? "…"}`, clear: { createdFrom: undefined, createdTo: undefined } });

  const activeCount = chips.length;
  const [open, setOpen] = useState(activeCount > 0);

  function setParams(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    setParams(Object.fromEntries(ORDER_FILTER_KEYS.map((k) => [k, undefined])));
  }

  return (
    <div className="space-y-2">
      {/* Toolbar: search · filters toggle · sort */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders, clients, addresses…"
            defaultValue={currentSearch}
            onChange={(e) => setParams({ search: e.target.value || undefined })}
            className="w-full rounded-lg border py-2 pl-9 pr-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {currentSearch && (
            <button
              onClick={() => setParams({ search: undefined })}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            open || activeCount > 0
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          )}
        >
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-blue-600 px-1.5 py-px text-[10px] font-bold leading-4 text-white">
              {activeCount}
            </span>
          )}
        </button>

        <div className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <select
            value={currentSort ?? "scheduled_desc"}
            onChange={(e) => setParams({ sort: e.target.value === "scheduled_desc" ? undefined : e.target.value })}
            className="w-full cursor-pointer appearance-none rounded-lg border bg-white py-2 pl-9 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-auto"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-2.5 pr-1.5 text-[11px] font-medium text-gray-700">
              {c.label}
              <button
                onClick={() => setParams(c.clear)}
                aria-label={`Clear filter ${c.label}`}
                className="rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button onClick={clearAll} className="ml-1 text-[11px] font-medium text-gray-400 hover:text-gray-600">
            Clear all
          </button>
        </div>
      )}

      {/* Advanced filter panel */}
      {open && (
        <div className="rounded-xl border bg-white p-4">
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Stage">
              <select value={filters.stage ?? ""} onChange={(e) => setParams({ stage: e.target.value || undefined })} className={selectClass}>
                <option value="">Any stage</option>
                {STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FilterField>
            <FilterField label="Payment">
              <select value={filters.pay ?? ""} onChange={(e) => setParams({ pay: e.target.value || undefined })} className={selectClass}>
                <option value="">Any payment status</option>
                {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FilterField>
            <FilterField label="Photographer">
              <select value={filters.staffId ?? ""} onChange={(e) => setParams({ staffId: e.target.value || undefined })} className={selectClass}>
                <option value="">Anyone</option>
                {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FilterField>
            <FilterField label="Service">
              <select value={filters.serviceId ?? ""} onChange={(e) => setParams({ serviceId: e.target.value || undefined })} className={selectClass}>
                <option value="">Any service</option>
                {serviceOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FilterField>
            <FilterField label="Priority">
              <select value={filters.priority ?? ""} onChange={(e) => setParams({ priority: e.target.value || undefined })} className={selectClass}>
                <option value="">Any priority</option>
                {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FilterField>
            <FilterField label="Scheduled between">
              <div className="flex items-center gap-1.5">
                <input type="date" value={filters.schedFrom ?? ""} onChange={(e) => setParams({ schedFrom: e.target.value || undefined })} className={dateClass} aria-label="Scheduled after" />
                <span className="text-xs text-gray-300">–</span>
                <input type="date" value={filters.schedTo ?? ""} onChange={(e) => setParams({ schedTo: e.target.value || undefined })} className={dateClass} aria-label="Scheduled before" />
              </div>
            </FilterField>
            <FilterField label="Created between">
              <div className="flex items-center gap-1.5">
                <input type="date" value={filters.createdFrom ?? ""} onChange={(e) => setParams({ createdFrom: e.target.value || undefined })} className={dateClass} aria-label="Created after" />
                <span className="text-xs text-gray-300">–</span>
                <input type="date" value={filters.createdTo ?? ""} onChange={(e) => setParams({ createdTo: e.target.value || undefined })} className={dateClass} aria-label="Created before" />
              </div>
            </FilterField>
            <div className="flex items-end justify-end">
              {activeCount > 0 && (
                <button onClick={clearAll} className="h-9 rounded-lg px-3 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700">
                  Reset filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

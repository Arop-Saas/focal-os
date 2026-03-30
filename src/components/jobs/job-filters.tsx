"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "EDITING", label: "Editing" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const SORT_OPTIONS = [
  { value: "scheduled_desc", label: "Scheduled: Newest" },
  { value: "scheduled_asc", label: "Scheduled: Oldest" },
  { value: "created_desc", label: "Created: Newest" },
  { value: "created_asc", label: "Created: Oldest" },
];

interface JobFiltersProps {
  currentStatus?: string;
  currentSearch?: string;
  currentSort?: string;
}

export function JobFilters({ currentStatus, currentSearch, currentSort }: JobFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs, clients, addresses…"
            defaultValue={currentSearch}
            onChange={(e) => setFilter("search", e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {currentSearch && (
            <button
              onClick={() => setFilter("search", "")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <select
            value={currentSort ?? "scheduled_desc"}
            onChange={(e) => setFilter("sort", e.target.value === "scheduled_desc" ? "" : e.target.value)}
            className="pl-9 pr-8 py-2 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer text-gray-700"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter("status", s.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              (currentStatus ?? "") === s.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

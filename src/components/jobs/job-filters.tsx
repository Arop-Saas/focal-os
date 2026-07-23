"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, ArrowUpDown } from "lucide-react";

const SORT_OPTIONS = [
  { value: "scheduled_desc", label: "Scheduled: Newest" },
  { value: "scheduled_asc", label: "Scheduled: Oldest" },
  { value: "created_desc", label: "Created: Newest" },
  { value: "created_asc", label: "Created: Oldest" },
];

interface JobFiltersProps {
  currentSearch?: string;
  currentSort?: string;
}

// Status tabs were replaced by the saved views bar (order-views.tsx)
export function JobFilters({ currentSearch, currentSort }: JobFiltersProps) {
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
            placeholder="Search orders, clients, addresses…"
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

    </div>
  );
}

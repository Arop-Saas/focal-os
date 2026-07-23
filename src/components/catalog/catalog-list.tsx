"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Archive, Camera, Calculator, ChevronDown, ChevronRight, Clock, Layers,
  Loader2, Package as PackageIcon, Plus, X,
} from "lucide-react";
import { CatalogItemPanel } from "./catalog-item-panel";
import { QuoteConsole } from "./quote-console";

export interface CatalogRow {
  id: string;
  role: "MAIN" | "ADD_ON" | "PACKAGE";
  state: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  category: string | null;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  pricingMode: string;
  baseDurationMins: number;
  visitMode: "NONE" | "SAME_VISIT" | "SEPARATE_VISIT";
  fulfillmentMode: "ON_SITE" | "PRODUCTION_ONLY" | "HYBRID";
  offeringCount: number;
  ruleCount: number;
  componentCount: number;
}

const TABS = [
  { key: "all", label: "All" },
  { key: "MAIN", label: "Main services" },
  { key: "ADD_ON", label: "Add-ons" },
  { key: "PACKAGE", label: "Packages" },
  { key: "DRAFT", label: "Drafts" },
  { key: "ARCHIVED", label: "Archived" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const ROLE_LABEL = { MAIN: "Main", ADD_ON: "Add-on", PACKAGE: "Package" };
const ROLE_CLS = {
  MAIN: "bg-blue-50 text-blue-700 border-blue-200",
  ADD_ON: "bg-violet-50 text-violet-700 border-violet-200",
  PACKAGE: "bg-amber-50 text-amber-700 border-amber-200",
};
const STATE_CLS = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DRAFT: "bg-gray-50 text-gray-500 border-gray-200",
  ARCHIVED: "bg-gray-100 text-gray-400 border-gray-200",
};

const inputCls =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

export function CatalogList({ rows }: { rows: CatalogRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");
  const [showNew, setShowNew] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const setState = trpc.catalog.setState.useMutation({ onSuccess: () => router.refresh() });

  const filtered = useMemo(() => {
    switch (tab) {
      case "all":      return rows.filter((r) => r.state !== "ARCHIVED");
      case "DRAFT":    return rows.filter((r) => r.state === "DRAFT");
      case "ARCHIVED": return rows.filter((r) => r.state === "ARCHIVED");
      default:         return rows.filter((r) => r.role === tab && r.state !== "ARCHIVED");
    }
  }, [rows, tab]);

  return (
    <div className="space-y-3">
      {/* Tabs + create */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                tab === t.key ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConsole(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <Calculator className="h-3.5 w-3.5" /> Test pricing
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" /> New service
          </button>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-16 text-center">
          <Layers className="mb-3 h-8 w-8 text-gray-200" />
          <p className="text-sm font-semibold text-gray-700">Nothing here yet</p>
          <p className="mt-1 text-xs text-gray-400">Create a service to start building your catalog.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="divide-y divide-gray-50">
            {filtered.map((r) => {
              const isOpen = expanded === r.id;
              return (
                <div key={r.id}>
                  <div
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                    )}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                      {r.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : r.role === "PACKAGE" ? (
                        <PackageIcon className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Camera className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-gray-900">{r.name}</p>
                        <span className={cn("shrink-0 rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide", ROLE_CLS[r.role])}>
                          {ROLE_LABEL[r.role]}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">
                        {r.category ?? "Uncategorized"}
                        {r.role === "PACKAGE" && r.componentCount > 0 && ` · ${r.componentCount} components`}
                        {r.ruleCount > 0 && ` · ${r.ruleCount} rule${r.ruleCount > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="hidden w-16 shrink-0 items-center justify-end gap-1 text-[11px] text-gray-500 sm:flex">
                      {r.fulfillmentMode !== "PRODUCTION_ONLY" && (
                        <>
                          <Clock className="h-3 w-3 text-gray-300" /> {r.baseDurationMins}m
                        </>
                      )}
                    </div>
                    <div className="w-20 shrink-0 text-right text-[13px] font-semibold text-gray-900">
                      {r.pricingMode === "STARTING_AT" && <span className="text-[10px] font-normal text-gray-400">from </span>}
                      {formatCurrency(r.basePrice)}
                    </div>
                    <span className={cn("w-20 shrink-0 rounded-full border px-2 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide", STATE_CLS[r.state])}>
                      {r.state.toLowerCase()}
                    </span>
                    <div className="hidden w-16 shrink-0 text-right text-[11px] text-gray-400 md:block">
                      {r.offeringCount > 0 ? `${r.offeringCount} form${r.offeringCount > 1 ? "s" : ""}` : "No forms"}
                    </div>
                    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {r.state !== "PUBLISHED" ? (
                        <button
                          onClick={() => setState.mutate({ id: r.id, state: "PUBLISHED" })}
                          disabled={setState.isPending}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          onClick={() => setState.mutate({ id: r.id, state: "ARCHIVED" })}
                          disabled={setState.isPending}
                          title="Archive"
                          className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {isOpen && <CatalogItemPanel itemId={r.id} role={r.role} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showNew && <NewServiceModal onClose={() => setShowNew(false)} />}
      {showConsole && (
        <QuoteConsole
          items={rows.filter((r) => r.state === "PUBLISHED").map((r) => ({ id: r.id, name: r.name }))}
          onClose={() => setShowConsole(false)}
        />
      )}
    </div>
  );
}

function NewServiceModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"MAIN" | "ADD_ON" | "PACKAGE">("MAIN");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("60");
  const [needsVisit, setNeedsVisit] = useState<"SAME_VISIT" | "SEPARATE_VISIT" | "NONE">("SAME_VISIT");

  const create = trpc.catalog.create.useMutation({
    onSuccess: () => { router.refresh(); onClose(); },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    create.mutate({
      name: name.trim(),
      role,
      category: category.trim() || undefined,
      basePrice: parseFloat(price) || 0,
      baseDurationMins: needsVisit === "NONE" ? 0 : parseInt(duration) || 60,
      visitMode: needsVisit,
      fulfillmentMode: needsVisit === "NONE" ? "PRODUCTION_ONLY" : "ON_SITE",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-base font-semibold text-gray-900">New service</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <div>
            <label htmlFor="cat-name" className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="HDR Photography" className={inputCls} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cat-role" className="mb-1 block text-sm font-medium text-gray-700">Type</label>
              <select id="cat-role" value={role} onChange={(e) => setRole(e.target.value as never)} className={inputCls}>
                <option value="MAIN">Main service</option>
                <option value="ADD_ON">Add-on</option>
                <option value="PACKAGE">Package</option>
              </select>
            </div>
            <div>
              <label htmlFor="cat-category" className="mb-1 block text-sm font-medium text-gray-700">Collection</label>
              <input id="cat-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Residential" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Property visit</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "SAME_VISIT", label: "Same visit" },
                { value: "SEPARATE_VISIT", label: "Separate visit" },
                { value: "NONE", label: "No visit" },
              ] as const).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setNeedsVisit(o.value)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-[12px] font-medium transition-colors",
                    needsVisit === o.value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {needsVisit === "NONE" && (
              <p className="mt-1 text-[11px] text-gray-400">Production-only — creates an editing task, never a calendar event.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cat-price" className="mb-1 block text-sm font-medium text-gray-700">Base price ($)</label>
              <input id="cat-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="299" inputMode="decimal" className={inputCls} />
            </div>
            {needsVisit !== "NONE" && (
              <div>
                <label htmlFor="cat-duration" className="mb-1 block text-sm font-medium text-gray-700">Duration (min)</label>
                <input id="cat-duration" value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" className={inputCls} />
              </div>
            )}
          </div>
          {create.error && <p className="text-sm text-red-600">{create.error.message}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || name.trim().length < 2}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create draft
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Loader2, Zap } from "lucide-react";

const inputCls =
  "h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const ROWS = [
  { type: "RUSH", label: "Rush fee", hint: "Added when an order is marked urgent" },
  { type: "AFTER_HOURS", label: "After-hours fee", hint: "Shoots before/after your evening and morning thresholds" },
  { type: "WEEKEND", label: "Weekend fee", hint: "Shoots on Saturday or Sunday" },
  { type: "MINIMUM_ORDER", label: "Minimum order", hint: "Orders below this amount are rounded up to it" },
] as const;

/** Order-level fees applied by the pricing pipeline before tax. */
export function AdjustmentsPanel() {
  const list = trpc.catalog.listAdjustments.useQuery();
  const upsert = trpc.catalog.upsertAdjustment.useMutation({ onSuccess: () => list.refetch() });

  // local drafts keyed by type (value fields save on blur)
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const byType = new Map((list.data ?? []).map((p) => [p.type, p]));

  function field(type: string, key: string, fallback: string): string {
    return drafts[type]?.[key] ?? fallback;
  }
  function setField(type: string, key: string, value: string) {
    setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], [key]: value } }));
  }

  function save(type: (typeof ROWS)[number]["type"], patch: Partial<{ active: boolean }> = {}) {
    const p = byType.get(type);
    const d = drafts[type] ?? {};
    upsert.mutate({
      type,
      active: patch.active ?? p?.active ?? false,
      amountType: (d.amountType ?? p?.amountType ?? "FLAT") as "FLAT" | "PERCENT",
      amount: parseFloat(d.amount ?? String(p?.amount ?? 0)) || 0,
      afterHoursStart: type === "AFTER_HOURS" ? parseInt(d.start ?? String(p?.afterHoursStart ?? 18)) : null,
      afterHoursEnd: type === "AFTER_HOURS" ? parseInt(d.end ?? String(p?.afterHoursEnd ?? 8)) : null,
      minimumOrderAmount: type === "MINIMUM_ORDER" ? parseFloat(d.min ?? String(p?.minimumOrderAmount ?? 0)) || 0 : null,
    });
  }

  return (
    <section className="rounded-xl border bg-white p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Zap className="h-4 w-4 text-gray-400" /> Order adjustments
      </h2>
      <p className="mt-1 text-[12px] text-gray-500">
        Automatic fees applied to the order subtotal before tax — each appears as its own labelled amount.
      </p>

      {list.isLoading ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-gray-300" />
      ) : (
        <div className="mt-3 divide-y divide-gray-50">
          {ROWS.map((row) => {
            const p = byType.get(row.type);
            const active = p?.active ?? false;
            return (
              <div key={row.type} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  aria-label={row.label}
                  onClick={() => save(row.type, { active: !active })}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
                    active ? "bg-blue-600" : "bg-gray-200"
                  )}
                >
                  <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", active ? "translate-x-4" : "translate-x-0")} />
                </button>
                <div className="min-w-[150px] flex-1">
                  <p className={cn("text-[13px] font-medium", active ? "text-gray-900" : "text-gray-400")}>{row.label}</p>
                  <p className="text-[11px] text-gray-400">{row.hint}</p>
                </div>

                {row.type !== "MINIMUM_ORDER" ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={field(row.type, "amount", String(p?.amount ?? ""))}
                      onChange={(e) => setField(row.type, "amount", e.target.value)}
                      onBlur={() => active && save(row.type)}
                      placeholder="50"
                      inputMode="decimal"
                      className={cn(inputCls, "w-20")}
                      aria-label={`${row.label} amount`}
                    />
                    <select
                      value={field(row.type, "amountType", p?.amountType ?? "FLAT")}
                      onChange={(e) => { setField(row.type, "amountType", e.target.value); }}
                      onBlur={() => active && save(row.type)}
                      className={cn(inputCls, "w-16")}
                      aria-label={`${row.label} type`}
                    >
                      <option value="FLAT">$</option>
                      <option value="PERCENT">%</option>
                    </select>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">$</span>
                    <input
                      value={field(row.type, "min", String(p?.minimumOrderAmount ?? ""))}
                      onChange={(e) => setField(row.type, "min", e.target.value)}
                      onBlur={() => active && save(row.type)}
                      placeholder="250"
                      inputMode="decimal"
                      className={cn(inputCls, "w-24 pl-6")}
                      aria-label="Minimum order amount"
                    />
                  </div>
                )}

                {row.type === "AFTER_HOURS" && (
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    after
                    <input
                      value={field(row.type, "start", String(p?.afterHoursStart ?? 18))}
                      onChange={(e) => setField(row.type, "start", e.target.value)}
                      onBlur={() => active && save(row.type)}
                      inputMode="numeric"
                      className={cn(inputCls, "w-12 text-center")}
                      aria-label="After-hours evening threshold (24h)"
                    />
                    or before
                    <input
                      value={field(row.type, "end", String(p?.afterHoursEnd ?? 8))}
                      onChange={(e) => setField(row.type, "end", e.target.value)}
                      onBlur={() => active && save(row.type)}
                      inputMode="numeric"
                      className={cn(inputCls, "w-12 text-center")}
                      aria-label="After-hours morning threshold (24h)"
                    />
                    o'clock
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {upsert.error && <p className="mt-1 text-[11px] text-red-600">{upsert.error.message}</p>}
    </section>
  );
}

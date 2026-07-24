"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import { BadgePercent, Loader2, Plus, Trash2, X } from "lucide-react";

const inputCls =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

/**
 * Pricing plans: per-brokerage (or everyone) price overrides, resolved by
 * the pricing service after product rules — lowest priority number wins.
 */
export function PricingPlans() {
  const plans = trpc.catalog.listPlans.useQuery();
  const groups = trpc.catalog.listBrokerageGroups.useQuery();
  const items = trpc.catalog.list.useQuery({ state: "PUBLISHED" });

  const createPlan = trpc.catalog.createPlan.useMutation({ onSuccess: () => { plans.refetch(); setAdding(false); setName(""); setGroupId(""); } });
  const setActive = trpc.catalog.setPlanActive.useMutation({ onSuccess: () => plans.refetch() });
  const deletePlan = trpc.catalog.deletePlan.useMutation({ onSuccess: () => plans.refetch() });

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");

  return (
    <section className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <BadgePercent className="h-4 w-4 text-gray-400" /> Pricing plans
          </h2>
          <p className="mt-1 text-[12px] text-gray-500">
            Special prices for a brokerage or for everyone — applied automatically at quote time.
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" /> New plan
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name — e.g. Compass rate card" autoFocus className={cn(inputCls, "min-w-[200px] flex-1")} />
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={cn(inputCls, "w-44")} aria-label="Applies to">
            <option value="">Everyone</option>
            {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button
            onClick={() => name.trim().length >= 2 && createPlan.mutate({ name: name.trim(), brokerageGroupId: groupId || null })}
            disabled={createPlan.isPending || name.trim().length < 2}
            className="rounded-lg bg-gray-900 px-3 py-2 text-[12px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {createPlan.isPending ? "Creating…" : "Create"}
          </button>
          <button onClick={() => setAdding(false)} aria-label="Cancel" className="rounded p-1.5 text-gray-400 hover:bg-white">
            <X className="h-4 w-4" />
          </button>
          {createPlan.error && <p className="w-full text-[11px] text-red-600">{createPlan.error.message}</p>}
        </div>
      )}

      <div className="mt-3 space-y-2.5">
        {plans.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
        ) : (plans.data ?? []).length === 0 ? (
          !adding && <p className="text-[12px] text-gray-400">No pricing plans yet.</p>
        ) : (
          (plans.data ?? []).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              items={(items.data ?? []).map((i) => ({ id: i.id, name: i.currentVersion?.name ?? "(unnamed)", basePrice: i.currentVersion?.basePrice ?? 0 }))}
              onToggle={(active) => setActive.mutate({ planId: plan.id, active })}
              onDelete={() => deletePlan.mutate({ planId: plan.id })}
              refetch={() => plans.refetch()}
            />
          ))
        )}
      </div>
    </section>
  );
}

type Plan = {
  id: string;
  name: string;
  active: boolean;
  brokerageGroup: { name: string } | null;
  client: { firstName: string; lastName: string } | null;
  entries: {
    id: string;
    catalogItemId: string;
    overridePrice: number | null;
    percentAdjust: number | null;
    item: { currentVersion: { name: string; basePrice: number } | null };
  }[];
};

function PlanCard({
  plan,
  items,
  onToggle,
  onDelete,
  refetch,
}: {
  plan: Plan;
  items: { id: string; name: string; basePrice: number }[];
  onToggle: (active: boolean) => void;
  onDelete: () => void;
  refetch: () => void;
}) {
  const upsert = trpc.catalog.upsertPlanEntry.useMutation({ onSuccess: refetch });
  const remove = trpc.catalog.deletePlanEntry.useMutation({ onSuccess: refetch });

  const [itemId, setItemId] = useState("");
  const [mode, setMode] = useState<"$" | "%">("$");
  const [value, setValue] = useState("");

  const existing = new Set(plan.entries.map((e) => e.catalogItemId));
  const options = items.filter((i) => !existing.has(i.id));
  const target = plan.client
    ? `${plan.client.firstName} ${plan.client.lastName}`
    : plan.brokerageGroup?.name ?? "Everyone";

  function addEntry() {
    const v = parseFloat(value);
    if (!itemId || isNaN(v)) return;
    upsert.mutate({
      planId: plan.id,
      catalogItemId: itemId,
      overridePrice: mode === "$" ? v : null,
      percentAdjust: mode === "%" ? v : null,
    });
    setItemId(""); setValue("");
  }

  return (
    <div className={cn("rounded-lg border p-3", plan.active ? "border-gray-200" : "border-gray-100 opacity-60")}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-gray-900">{plan.name}</p>
          <p className="text-[11px] text-gray-400">
            Applies to <span className="font-medium text-gray-600">{target}</span>
            {!plan.active && " · inactive"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={plan.active}
            aria-label={`${plan.name} active`}
            onClick={() => onToggle(!plan.active)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
              plan.active ? "bg-blue-600" : "bg-gray-200"
            )}
          >
            <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", plan.active ? "translate-x-4" : "translate-x-0")} />
          </button>
          <button onClick={onDelete} aria-label="Delete plan" className="rounded p-1.5 text-gray-300 hover:bg-gray-100 hover:text-red-500">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {plan.entries.length > 0 && (
        <div className="mt-2.5 space-y-1">
          {plan.entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-2.5 py-1.5">
              <p className="min-w-0 truncate text-[12px] text-gray-700">{e.item.currentVersion?.name ?? "(item)"}</p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[12px] font-medium text-gray-900">
                  {e.overridePrice != null
                    ? formatCurrency(e.overridePrice)
                    : `${(e.percentAdjust ?? 0) > 0 ? "+" : ""}${e.percentAdjust}%`}
                </span>
                <button onClick={() => remove.mutate({ entryId: e.id })} aria-label="Remove entry" className="rounded p-0.5 text-gray-300 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5">
        <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={cn(inputCls, "min-w-0 flex-1")} aria-label="Service">
          <option value="">Add a service…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name} ({formatCurrency(o.basePrice)})</option>
          ))}
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value as "$" | "%")} className={cn(inputCls, "w-14")} aria-label="Adjustment type">
          <option value="$">$</option>
          <option value="%">%</option>
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === "$" ? "249" : "-10"}
          inputMode="decimal"
          className={cn(inputCls, "w-20")}
          aria-label={mode === "$" ? "Price" : "Percent adjustment"}
        />
        <button
          onClick={addEntry}
          disabled={upsert.isPending || !itemId || !value}
          className="rounded-lg bg-gray-900 p-2 text-white hover:bg-gray-800 disabled:opacity-50"
          aria-label="Add entry"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {(upsert.error || remove.error) && (
        <p className="mt-1 text-[11px] text-red-600">{upsert.error?.message ?? remove.error?.message}</p>
      )}
    </div>
  );
}

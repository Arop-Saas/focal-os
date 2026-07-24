"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Plus, Ruler, Trash2 } from "lucide-react";

const inputCls =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

/**
 * Expanded detail panel for one catalog item: edit (creates a new version),
 * offered-on order forms, package components, and square-footage rules.
 */
export function CatalogItemPanel({
  itemId,
  role,
  rulesEnabled,
}: {
  itemId: string;
  role: "MAIN" | "ADD_ON" | "PACKAGE";
  rulesEnabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 border-t border-gray-100 bg-gray-50/60 px-5 py-4 pl-12 lg:grid-cols-2">
      <EditSection itemId={itemId} />
      <div className="space-y-5">
        <OfferedOnSection itemId={itemId} />
        {role === "PACKAGE" && <ComponentsSection itemId={itemId} />}
        <RulesSection itemId={itemId} rulesEnabled={rulesEnabled} />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">{children}</p>
  );
}

// ── Edit (creates a new version on save) ────────────────────────────────────

function EditSection({ itemId }: { itemId: string }) {
  const router = useRouter();
  const item = trpc.catalog.getItem.useQuery({ id: itemId });
  const update = trpc.catalog.updateItem.useMutation({
    onSuccess: () => { item.refetch(); router.refresh(); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<null | {
    name: string; category: string; description: string; basePrice: string;
    baseDurationMins: string; visitMode: "NONE" | "SAME_VISIT" | "SEPARATE_VISIT";
  }>(null);

  if (item.isLoading || !item.data?.currentVersion) {
    return (
      <div>
        <SectionTitle>Details</SectionTitle>
        <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
      </div>
    );
  }

  const v = item.data.currentVersion;
  const d = draft ?? {
    name: v.name,
    category: item.data.category ?? "",
    description: v.description ?? "",
    basePrice: String(v.basePrice),
    baseDurationMins: String(v.baseDurationMins),
    visitMode: v.visitMode,
  };
  const set = (patch: Partial<typeof d>) => setDraft({ ...d, ...patch });
  const dirty = draft !== null;

  function save() {
    update.mutate({
      id: itemId,
      name: d.name.trim() || undefined,
      category: d.category.trim() || null,
      description: d.description.trim() || null,
      basePrice: parseFloat(d.basePrice) || 0,
      baseDurationMins: parseInt(d.baseDurationMins) || 0,
      visitMode: d.visitMode,
      fulfillmentMode: d.visitMode === "NONE" ? "PRODUCTION_ONLY" : undefined,
    });
    setDraft(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionTitle>Details · v{v.versionNumber}</SectionTitle>
        <span aria-live="polite" className={cn("flex items-center gap-1 text-[11px] font-medium text-emerald-600 transition-opacity", saved ? "opacity-100" : "opacity-0")}>
          <CheckCircle2 className="h-3 w-3" /> Saved as v{v.versionNumber}
        </span>
      </div>
      <div className="space-y-2.5">
        <input value={d.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} aria-label="Name" />
        <div className="grid grid-cols-2 gap-2">
          <input value={d.category} onChange={(e) => set({ category: e.target.value })} placeholder="Collection" className={inputCls} aria-label="Collection" />
          <select
            value={d.visitMode}
            onChange={(e) => set({ visitMode: e.target.value as typeof d.visitMode })}
            className={inputCls}
            aria-label="Property visit"
          >
            <option value="SAME_VISIT">Same visit</option>
            <option value="SEPARATE_VISIT">Separate visit</option>
            <option value="NONE">No visit (production only)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">$</span>
            <input value={d.basePrice} onChange={(e) => set({ basePrice: e.target.value })} inputMode="decimal" className={cn(inputCls, "pl-6")} aria-label="Base price" />
          </div>
          {d.visitMode !== "NONE" && (
            <div className="relative">
              <input value={d.baseDurationMins} onChange={(e) => set({ baseDurationMins: e.target.value })} inputMode="numeric" className={cn(inputCls, "pr-10")} aria-label="Duration minutes" />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">min</span>
            </div>
          )}
        </div>
        <textarea
          value={d.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={2}
          placeholder="Customer-facing description…"
          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          aria-label="Description"
        />
        {update.error && <p className="text-[11px] text-red-600">{update.error.message}</p>}
        {dirty && (
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={update.isPending}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {update.isPending ? "Saving…" : `Save as v${v.versionNumber + 1}`}
            </button>
            <button onClick={() => setDraft(null)} className="text-[12px] text-gray-400 hover:text-gray-600">
              Discard
            </button>
            <p className="text-[10px] text-gray-400">Existing orders keep the version they purchased.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Offered on ──────────────────────────────────────────────────────────────

function OfferedOnSection({ itemId }: { itemId: string }) {
  const router = useRouter();
  const forms = trpc.catalog.listOrderForms.useQuery();
  const offerings = trpc.catalog.listOfferings.useQuery({ itemId });
  const setOffering = trpc.catalog.setOffering.useMutation({
    onSuccess: () => { offerings.refetch(); router.refresh(); },
  });

  const offeredForms = new Set((offerings.data ?? []).map((o) => o.orderFormId));

  return (
    <div>
      <SectionTitle>Offered on</SectionTitle>
      {forms.isLoading || offerings.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
      ) : (forms.data ?? []).length === 0 ? (
        <p className="text-[12px] text-gray-400">No order forms yet — create one under Forms/Services.</p>
      ) : (
        <div className="space-y-1.5">
          {(forms.data ?? []).map((f) => {
            const on = offeredForms.has(f.id);
            return (
              <label
                key={f.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2 transition-colors hover:border-gray-300"
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={setOffering.isPending}
                  onChange={(e) => setOffering.mutate({ itemId, orderFormId: f.id, offered: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[13px] text-gray-800">{f.title}</span>
              </label>
            );
          })}
        </div>
      )}
      {setOffering.error && <p className="mt-1 text-[11px] text-red-600">{setOffering.error.message}</p>}
    </div>
  );
}

// ── Package components ──────────────────────────────────────────────────────

function ComponentsSection({ itemId }: { itemId: string }) {
  const router = useRouter();
  const components = trpc.catalog.listComponents.useQuery({ packageItemId: itemId });
  const candidates = trpc.catalog.list.useQuery({});
  const addComponent = trpc.catalog.addComponent.useMutation({
    onSuccess: () => { components.refetch(); router.refresh(); },
  });
  const removeComponent = trpc.catalog.removeComponent.useMutation({
    onSuccess: () => { components.refetch(); router.refresh(); },
  });

  const [childId, setChildId] = useState("");
  const [qty, setQty] = useState("1");

  const existing = new Set((components.data ?? []).map((c) => c.childItemId));
  const options = (candidates.data ?? []).filter(
    (c) => c.role !== "PACKAGE" && c.id !== itemId && !existing.has(c.id) && c.state !== "ARCHIVED"
  );

  return (
    <div>
      <SectionTitle>Package components</SectionTitle>
      {components.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
      ) : (
        <div className="space-y-1.5">
          {(components.data ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <p className="min-w-0 truncate text-[13px] text-gray-800">
                {c.child.currentVersion?.name ?? "(unnamed)"}
                {c.quantity > 1 && <span className="text-gray-400"> ×{c.quantity}</span>}
              </p>
              <button
                onClick={() => removeComponent.mutate({ componentId: c.id })}
                aria-label="Remove component"
                className="shrink-0 rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {(components.data ?? []).length === 0 && (
            <p className="text-[12px] text-gray-400">No components — reference the services this package includes.</p>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5">
        <select value={childId} onChange={(e) => setChildId(e.target.value)} className={cn(inputCls, "flex-1")} aria-label="Service to include">
          <option value="">Add a service…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.currentVersion?.name ?? "(unnamed)"}</option>
          ))}
        </select>
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className={cn(inputCls, "w-14")} aria-label="Quantity" />
        <button
          onClick={() => {
            if (!childId) return;
            addComponent.mutate({ packageItemId: itemId, childItemId: childId, quantity: parseInt(qty) || 1 });
            setChildId(""); setQty("1");
          }}
          disabled={!childId || addComponent.isPending}
          className="rounded-lg bg-gray-900 p-2 text-white hover:bg-gray-800 disabled:opacity-50"
          aria-label="Add component"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {(addComponent.error || removeComponent.error) && (
        <p className="mt-1 text-[11px] text-red-600">{addComponent.error?.message ?? removeComponent.error?.message}</p>
      )}
    </div>
  );
}

// ── Square-footage rules (sentence builder) ─────────────────────────────────

function RulesSection({ itemId, rulesEnabled }: { itemId: string; rulesEnabled: boolean }) {
  const router = useRouter();
  const rules = trpc.catalog.listRules.useQuery({ itemId });
  const addRule = trpc.catalog.addRule.useMutation({
    onSuccess: () => { rules.refetch(); router.refresh(); },
  });
  const deleteRule = trpc.catalog.deleteRule.useMutation({
    onSuccess: () => { rules.refetch(); router.refresh(); },
  });

  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [price, setPrice] = useState("");
  const [mins, setMins] = useState("");

  function submit() {
    const priceAdd = parseFloat(price) || 0;
    const durationAddMins = parseInt(mins) || 0;
    if (!priceAdd && !durationAddMins) return;
    const minV = min ? parseFloat(min) : null;
    const maxV = max ? parseFloat(max) : null;
    const range = `${minV != null ? minV.toLocaleString() : "0"}–${maxV != null ? maxV.toLocaleString() : "∞"} sq ft`;
    const effects = [
      priceAdd ? `${priceAdd > 0 ? "+" : "−"}$${Math.abs(priceAdd)}` : null,
      durationAddMins ? `${durationAddMins > 0 ? "+" : "−"}${Math.abs(durationAddMins)} min` : null,
    ].filter(Boolean).join(", ");
    addRule.mutate({ itemId, name: `${range}: ${effects}`, conditionMin: minV, conditionMax: maxV, priceAdd, durationAddMins });
    setMin(""); setMax(""); setPrice(""); setMins("");
  }

  return (
    <div>
      <SectionTitle>
        <span className="flex items-center gap-1.5"><Ruler className="h-3 w-3" /> Square-footage rules</span>
      </SectionTitle>

      {!rulesEnabled && (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          Rule-based pricing is off — rules are saved but not applied.{" "}
          <a href="/catalog?section=pricing" className="font-medium underline">Enable it in Pricing</a>.
        </p>
      )}

      {rules.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
      ) : (
        <div className="space-y-1.5">
          {(rules.data ?? []).map((rule) => (
            <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <p className="text-[12px] text-gray-700">
                <span className="font-medium">When</span> {rule.conditionMin?.toLocaleString() ?? "0"}–{rule.conditionMax?.toLocaleString() ?? "∞"} sq ft
                <span className="font-medium"> then</span>
                {rule.priceAdd !== 0 && ` ${rule.priceAdd > 0 ? "add" : "subtract"} $${Math.abs(rule.priceAdd)}`}
                {rule.priceAdd !== 0 && rule.durationAddMins !== 0 && " and"}
                {rule.durationAddMins !== 0 && ` ${rule.durationAddMins > 0 ? "add" : "subtract"} ${Math.abs(rule.durationAddMins)} min`}
              </p>
              <button
                onClick={() => deleteRule.mutate({ ruleId: rule.id })}
                aria-label="Delete rule"
                className="shrink-0 rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {(rules.data ?? []).length === 0 && (
            <p className="text-[12px] text-gray-400">No rules — price and duration stay flat for any size.</p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-gray-600">
        <span className="font-medium">When</span>
        <input value={min} onChange={(e) => setMin(e.target.value)} placeholder="2,501" inputMode="numeric" className={cn(inputCls, "w-20")} aria-label="Min square footage" />
        <span>–</span>
        <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="4,000" inputMode="numeric" className={cn(inputCls, "w-20")} aria-label="Max square footage" />
        <span>sq ft,</span>
        <span className="font-medium">add</span>
        <span>$</span>
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="75" inputMode="decimal" className={cn(inputCls, "w-16")} aria-label="Price to add" />
        <span>and</span>
        <input value={mins} onChange={(e) => setMins(e.target.value)} placeholder="30" inputMode="numeric" className={cn(inputCls, "w-14")} aria-label="Minutes to add" />
        <span>min</span>
        <button
          onClick={submit}
          disabled={addRule.isPending}
          className="ml-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {addRule.isPending ? "Adding…" : "Add rule"}
        </button>
      </div>
      {addRule.error && <p className="mt-1.5 text-[11px] text-red-600">{addRule.error.message}</p>}
    </div>
  );
}

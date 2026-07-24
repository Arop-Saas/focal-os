"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import { Calculator, Loader2, X } from "lucide-react";

const inputCls =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

/**
 * Rule test console (plan §7): pick services, enter a square footage, and see
 * exactly how the pricing service computes each line — the same
 * quoteOrderLines call order creation uses, so what you test is what ships.
 */
export function QuoteConsole({
  items,
  onClose,
}: {
  items: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [sqft, setSqft] = useState("");

  const lines = Object.entries(selected).map(([catalogItemId, quantity]) => ({ catalogItemId, quantity }));
  const quote = trpc.catalog.quotePreview.useQuery(
    { squareFootage: sqft ? parseFloat(sqft) : null, lines },
    { enabled: lines.length > 0 }
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Calculator className="h-4 w-4 text-gray-400" /> Price quote
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden sm:grid-cols-2">
          {/* Inputs */}
          <div className="overflow-y-auto border-r p-5">
            <label htmlFor="qc-sqft" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Property square footage
            </label>
            <input
              id="qc-sqft"
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
              placeholder="3,200"
              inputMode="numeric"
              className={inputCls}
            />

            <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wide text-gray-400">Services</p>
            <div className="space-y-1.5">
              {items.length === 0 && <p className="text-[12px] text-gray-400">No published services yet.</p>}
              {items.map((i) => {
                const qty = selected[i.id];
                return (
                  <div
                    key={i.id}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                      qty ? "border-blue-300 bg-blue-50/50" : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!!qty}
                      onChange={() => toggle(i.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Include ${i.name}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-gray-800">{i.name}</span>
                    {qty && (
                      <input
                        value={qty}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [i.id]: Math.max(1, parseInt(e.target.value) || 1) }))
                        }
                        inputMode="numeric"
                        className={cn(inputCls, "w-12 text-center")}
                        aria-label={`${i.name} quantity`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Result */}
          <div className="overflow-y-auto bg-gray-50/60 p-5">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Quote</p>
            {lines.length === 0 ? (
              <p className="text-[12px] text-gray-400">Select services to see the computed price and why.</p>
            ) : quote.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
            ) : quote.error ? (
              <p className="text-[12px] text-red-600">{quote.error.message}</p>
            ) : (
              <div className="space-y-2.5">
                {(quote.data?.lines ?? []).map((l, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-[13px] font-semibold text-gray-900">
                        {l.name}
                        {l.quantity > 1 && <span className="font-normal text-gray-400"> ×{l.quantity}</span>}
                      </p>
                      <p className="shrink-0 text-[13px] font-semibold text-gray-900">{formatCurrency(l.totalPrice)}</p>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {l.explanation.map((e, j) => (
                        <li key={j} className="text-[11px] text-gray-500">· {e}</li>
                      ))}
                      {l.durationMins > 0 && (
                        <li className="text-[11px] text-gray-400">· On-site time: {l.durationMins} min</li>
                      )}
                    </ul>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2.5">
                  <p className="text-[13px] font-semibold text-gray-900">Subtotal</p>
                  <p className="text-[15px] font-bold text-gray-900">{formatCurrency(quote.data?.subtotal ?? 0)}</p>
                </div>
                <p className="text-[10px] text-gray-400">
                  Computed by the same pricing service order creation uses — before tax, travel and fees.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

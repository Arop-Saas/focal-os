"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, MapPin, Percent, Ruler } from "lucide-react";
import { PricingPlans } from "./pricing-plans";
import { AdjustmentsPanel } from "./adjustments-panel";

/**
 * Pricing home (plan §3 "Pricing"): rule-based pricing opt-in, taxes, travel.
 * Pricing plans / rush / after-hours adjustments land here as Phase 2 grows.
 */
export function PricingPanel({
  initial,
}: {
  initial: {
    pricingRulesEnabled: boolean;
    defaultTaxRate: number;
    outsideBookingEnabled: boolean;
    outsideFeeType: string;
    outsideTerritoryFee: number | null;
    outsidePerKmRate: number | null;
  };
}) {
  const router = useRouter();
  const update = trpc.workspace.update.useMutation({ onSuccess: () => router.refresh() });

  const [rulesOn, setRulesOn] = useState(initial.pricingRulesEnabled);
  const [taxRate, setTaxRate] = useState(String(initial.defaultTaxRate));
  const [taxSaved, setTaxSaved] = useState(false);

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-4">
      {/* Rule-based pricing */}
      <section className="rounded-xl border bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Ruler className="h-4 w-4 text-gray-400" /> Rule-based pricing
            </h2>
            <p className="mt-1 max-w-md text-[12px] leading-relaxed text-gray-500">
              Adjust price and shoot time automatically by property size using per-service rules
              (e.g. "2,501–4,000 sq ft: add $75 and 30 minutes"). Rules are set on each service;
              this switch controls whether they're applied to quotes, orders and bookings.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={rulesOn}
            aria-label="Rule-based pricing"
            disabled={update.isPending}
            onClick={() => {
              const next = !rulesOn;
              setRulesOn(next);
              update.mutate({ pricingRulesEnabled: next });
            }}
            className={cn(
              "relative mt-1 inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
              rulesOn ? "bg-blue-600" : "bg-gray-200"
            )}
          >
            <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", rulesOn ? "translate-x-5" : "translate-x-0")} />
          </button>
        </div>
        {rulesOn && (
          <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
            Active — rules apply everywhere prices are computed: the booking form, admin orders and price quotes.
          </p>
        )}
      </section>

      {/* Pricing plans */}
      <PricingPlans />

      {/* Order adjustments */}
      <AdjustmentsPanel />

      {/* Taxes */}
      <section className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Percent className="h-4 w-4 text-gray-400" /> Tax
          </h2>
          <span aria-live="polite" className={cn("flex items-center gap-1 text-[11px] font-medium text-emerald-600 transition-opacity", taxSaved ? "opacity-100" : "opacity-0")}>
            <CheckCircle2 className="h-3 w-3" /> Saved
          </span>
        </div>
        <p className="mt-1 text-[12px] text-gray-500">Default tax rate applied to orders and invoices.</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative w-32">
            <input
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              onBlur={() => {
                const v = Math.min(100, Math.max(0, parseFloat(taxRate) || 0));
                if (v !== initial.defaultTaxRate) {
                  update.mutate({ defaultTaxRate: v }, { onSuccess: () => { setTaxSaved(true); setTimeout(() => setTaxSaved(false), 2000); router.refresh(); } });
                }
              }}
              inputMode="decimal"
              aria-label="Default tax rate percent"
              className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 pr-8 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">%</span>
          </div>
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin text-gray-300" />}
        </div>
      </section>

      {/* Travel */}
      <section className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MapPin className="h-4 w-4 text-gray-400" /> Travel fees
            </h2>
            <p className="mt-1 text-[12px] text-gray-500">
              {initial.outsideBookingEnabled
                ? initial.outsideFeeType === "per_km"
                  ? `Outside-territory bookings charge $${initial.outsidePerKmRate ?? 0}/km.`
                  : `Outside-territory bookings charge a flat $${initial.outsideTerritoryFee ?? 0}.`
                : "Bookings outside your territories are currently not allowed."}
            </p>
          </div>
          <Link href="/territories" className="shrink-0 text-[12px] font-medium text-blue-600 hover:text-blue-700">
            Manage →
          </Link>
        </div>
      </section>

      <p className="text-[11px] text-gray-400">
        Coming to this section: coupons through the pricing pipeline, and payout margin
        warnings.
      </p>
    </div>
  );
}

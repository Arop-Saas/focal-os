"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { Loader2, Zap, Tag } from "lucide-react";

interface Props {
  jobId: string;
  packageName?: string | null;
  packagePrice?: number | null;
  // Brokerage group info — passed from the server-rendered job page
  brokerageGroupName?:  string | null;
  brokerageDiscountType?:  string | null;
  brokerageDiscountValue?: number | null;
}

export function JobAutoInvoiceButton({
  jobId,
  packageName,
  packagePrice,
  brokerageGroupName,
  brokerageDiscountType,
  brokerageDiscountValue,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const utils = api.useUtils();

  const createMutation = api.invoices.createFromJob.useMutation({
    onSuccess: (invoice) => {
      utils.jobs.getById.invalidate({ id: jobId });
      router.push(`/invoices/${invoice.id}`);
    },
    onError: (err) => {
      setError(err.message ?? "Failed to create invoice");
    },
  });

  // Compute discounted preview price
  let discountedPrice: number | null = null;
  let discountLabel: string | null   = null;
  if (packagePrice != null && brokerageGroupName && brokerageDiscountValue != null) {
    if (brokerageDiscountType === "PERCENTAGE") {
      discountedPrice = parseFloat((packagePrice * (1 - brokerageDiscountValue / 100)).toFixed(2));
      discountLabel   = `${brokerageDiscountValue}% off (${brokerageGroupName})`;
    } else {
      discountedPrice = Math.max(0, parseFloat((packagePrice - brokerageDiscountValue).toFixed(2)));
      discountLabel   = `$${brokerageDiscountValue.toFixed(2)} off (${brokerageGroupName})`;
    }
  }

  return (
    <div className="text-center py-3">
      <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-2">
        <Zap className="w-4 h-4 text-green-600" />
      </div>
      <p className="text-xs text-gray-500 mb-1">No invoice yet</p>

      {packageName && packagePrice != null && (
        <div className="mb-3 space-y-1">
          {discountedPrice !== null ? (
            <>
              <p className="text-[11px] text-gray-400 line-through">{packageName} · ${packagePrice.toFixed(2)}</p>
              <p className="text-[11px] font-semibold text-green-700">${discountedPrice.toFixed(2)}</p>
              <div className="inline-flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                <Tag className="w-2.5 h-2.5" />
                {discountLabel}
              </div>
            </>
          ) : (
            <p className="text-[11px] text-gray-400">{packageName} · ${packagePrice.toFixed(2)}</p>
          )}
        </div>
      )}

      <button
        onClick={() => {
          setError(null);
          createMutation.mutate({ jobId });
        }}
        disabled={createMutation.isPending}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 py-1.5 rounded-lg transition-colors"
      >
        {createMutation.isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Zap className="w-3 h-3" />
        )}
        {createMutation.isPending ? "Creating…" : "Create Invoice"}
      </button>

      {(packageName == null || packagePrice == null) && (
        <a
          href={`/invoices/new?jobId=${jobId}`}
          className="block text-center text-[11px] text-gray-400 hover:text-gray-600 mt-2 transition-colors"
        >
          Or build manually →
        </a>
      )}
      {error && <p className="text-[10px] text-red-500 mt-2">{error}</p>}
    </div>
  );
}

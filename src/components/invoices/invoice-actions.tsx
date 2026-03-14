"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { Send, Check, Ban, Loader2 } from "lucide-react";

interface InvoiceActionsProps {
  invoice: {
    id: string;
    status: string;
    amountDue: number;
    totalAmount: number;
  };
}

export function InvoiceActions({ invoice }: InvoiceActionsProps) {
  const router = useRouter();
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(invoice.amountDue.toFixed(2));

  const sendMutation = api.invoices.send.useMutation({
    onSuccess: () => router.refresh(),
  });
  const markPaidMutation = api.invoices.markPaid.useMutation({
    onSuccess: () => {
      setMarkPaidOpen(false);
      router.refresh();
    },
  });
  const voidMutation = api.invoices.void.useMutation({
    onSuccess: () => router.refresh(),
  });

  const isLoading =
    sendMutation.isPending || markPaidMutation.isPending || voidMutation.isPending;

  return (
    <div className="flex items-center gap-2">

      {/* Send (DRAFT only) */}
      {invoice.status === "DRAFT" && (
        <button
          onClick={() => sendMutation.mutate({ id: invoice.id })}
          disabled={isLoading}
          className="flex items-center gap-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
        >
          {sendMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Send Invoice
        </button>
      )}

      {/* Mark Paid (when amountDue > 0 and not voided) */}
      {invoice.amountDue > 0 && invoice.status !== "VOID" && (
        <div className="relative">
          <button
            onClick={() => setMarkPaidOpen((v) => !v)}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {markPaidMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Mark Paid
          </button>

          {markPaidOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMarkPaidOpen(false)}
              />
              {/* Popover */}
              <div className="absolute right-0 top-full mt-2 z-20 bg-white rounded-xl border border-gray-200 shadow-lg p-4 w-64">
                <p className="text-sm font-semibold text-gray-900 mb-3">Record Payment</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Amount ({formatCurrency(invoice.amountDue)} due)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const amount = parseFloat(payAmount);
                        if (amount > 0) {
                          markPaidMutation.mutate({ id: invoice.id, amount });
                        }
                      }}
                      disabled={markPaidMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-60"
                    >
                      {markPaidMutation.isPending ? "Saving…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setMarkPaidOpen(false)}
                      className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Void (not PAID and not already VOID) */}
      {invoice.status !== "PAID" && invoice.status !== "VOID" && (
        <button
          onClick={() => {
            if (confirm("Void this invoice? This cannot be undone.")) {
              voidMutation.mutate({ id: invoice.id });
            }
          }}
          disabled={isLoading}
          className="flex items-center gap-2 text-sm font-medium border border-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 text-gray-600 px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
        >
          {voidMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Ban className="w-3.5 h-3.5" />
          )}
          Void
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import { Check, Copy, CreditCard, Loader2, Mail, Plus, Receipt } from "lucide-react";
import { DIM_BADGE } from "./status-meta";

/**
 * Services & Billing — the order's line items and money in one card.
 * New services are picked from the published catalog, priced server-side,
 * and mapped to an appointment (existing, new, or none) by the user.
 */

export interface BillingLine {
  id: string;
  name: string;
  quantity: number;
  totalPrice: number;
  explanation: string[];
}

export interface BillingTotals {
  subtotal: number;
  priorityFee: number;
  discount: number;
  tax: number;
  total: number;
}

export interface CatalogOption {
  id: string;
  name: string;
  basePrice: number;
}

export interface ApptOption {
  id: string;
  label: string;
}

interface ServicesBillingProps {
  jobId: string;
  lines: BillingLine[];
  /** fallback rows for orders that predate line snapshots */
  legacyLines: { id: string; name: string; quantity: number; totalPrice: number }[];
  totals: BillingTotals;
  payChip: { value: string; cls: string };
  invoice: { id: string; number: string; payToken: string | null; amountDue: number; status: string } | null;
  catalogItems: CatalogOption[];
  appointments: ApptOption[];
  /** server-rendered invoice action (auto-invoice button) when no invoice exists */
  invoiceAction?: React.ReactNode;
}

export function ServicesBilling({
  jobId,
  lines,
  legacyLines,
  totals,
  payChip,
  invoice,
  catalogItems,
  appointments,
  invoiceAction,
}: ServicesBillingProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [apptChoice, setApptChoice] = useState("NONE");

  const addLine = trpc.jobs.addOrderLine.useMutation({
    onSuccess: () => {
      setAdding(false);
      setItemId("");
      setQty(1);
      setApptChoice("NONE");
      router.refresh();
    },
  });

  const submit = () => {
    if (!itemId || addLine.isPending) return;
    addLine.mutate({
      jobId,
      catalogItemId: itemId,
      quantity: qty,
      appointmentMode: apptChoice === "NONE" ? "NONE" : apptChoice === "NEW" ? "NEW" : "EXISTING",
      appointmentId: apptChoice !== "NONE" && apptChoice !== "NEW" ? apptChoice : undefined,
    });
  };

  const rows = lines.length > 0 ? lines : legacyLines.map((l) => ({ ...l, explanation: [] as string[] }));

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
          <Receipt className="h-4 w-4 text-gray-400" /> Services & Billing
        </h2>
        <span className={cn(DIM_BADGE, payChip.cls)}>{payChip.value}</span>
      </div>

      {/* Line items */}
      {rows.length === 0 ? (
        <p className="text-[12px] italic text-gray-400">No services on this order yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((l) => (
            <div key={l.id} className="border-b border-gray-50 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900">
                  {l.name}
                  {l.quantity > 1 && <span className="font-normal text-gray-400"> × {l.quantity}</span>}
                </span>
                <span className="font-medium text-gray-900">{formatCurrency(l.totalPrice)}</span>
              </div>
              {l.explanation.length > 0 && (
                <p className="mt-0.5 text-[11px] text-gray-400">{l.explanation.join(" · ")}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add a service */}
      {catalogItems.length > 0 && (
        adding ? (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none"
              >
                <option value="">Choose a service or product…</option>
                {catalogItems.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {formatCurrency(c.basePrice)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                className="w-14 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-xs outline-none"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={apptChoice}
                onChange={(e) => setApptChoice(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none"
              >
                <option value="NONE">No appointment needed</option>
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>Add to: {a.label}</option>
                ))}
                <option value="NEW">Create a new appointment</option>
              </select>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!itemId || addLine.isPending}
                  className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                >
                  {addLine.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Add to order
                </button>
              </div>
            </div>
            {addLine.error && <p className="mt-1.5 text-xs text-red-600">{addLine.error.message}</p>}
            {invoice && (
              <p className="mt-1.5 text-[11px] text-amber-700">
                This order already has invoice #{invoice.number} — new services are not added to it automatically.
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add service or product
          </button>
        )
      )}

      {/* Totals */}
      <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-2.5 text-[12px]">
        <div className="flex items-center justify-between text-gray-600">
          <span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span>
        </div>
        {totals.priorityFee > 0 && (
          <div className="flex items-center justify-between text-gray-600">
            <span>Priority fee</span><span>{formatCurrency(totals.priorityFee)}</span>
          </div>
        )}
        {totals.discount > 0 && (
          <div className="flex items-center justify-between text-gray-600">
            <span>Discount</span><span>−{formatCurrency(totals.discount)}</span>
          </div>
        )}
        {totals.tax > 0 && (
          <div className="flex items-center justify-between text-gray-600">
            <span>Tax</span><span>{formatCurrency(totals.tax)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[13px] font-semibold text-gray-900">
          <span>Total</span><span>{formatCurrency(totals.total)}</span>
        </div>
      </div>

      {/* Invoice */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        {invoice ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/invoices/${invoice.id}`}
              className="flex-1 rounded-lg border border-blue-200 py-2 text-center text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
            >
              View invoice #{invoice.number}
            </Link>
            {invoice.amountDue > 0 && invoice.status !== "VOID" && (
              <button
                type="button"
                onClick={() => setCollecting(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
              >
                <CreditCard className="h-3.5 w-3.5" /> Collect payment
              </button>
            )}
          </div>
        ) : (
          invoiceAction ?? <p className="text-[12px] text-gray-400">No invoice yet</p>
        )}
      </div>

      {collecting && invoice && typeof document !== "undefined" && createPortal(
        <CollectPaymentModal invoice={invoice} onClose={() => setCollecting(false)} />,
        document.body
      )}
    </section>
  );
}

function CollectPaymentModal({
  invoice,
  onClose,
}: {
  invoice: { id: string; number: string; payToken: string | null; amountDue: number; status: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState(invoice.amountDue);
  const [method, setMethod] = useState("CARD");

  const send = trpc.invoices.send.useMutation({
    onSuccess: () => {
      onClose();
      router.refresh();
    },
  });
  const markPaid = trpc.invoices.markPaid.useMutation({
    onSuccess: () => {
      onClose();
      router.refresh();
    },
  });

  const payUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${invoice.payToken ?? invoice.id}`;
  const copyLink = () => {
    navigator.clipboard.writeText(payUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900">Collect payment</h2>
          </div>
          <button onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-600">×</button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{formatCurrency(invoice.amountDue)}</span> outstanding
            on invoice #{invoice.number}.
          </p>

          {invoice.status === "DRAFT" && (
            <button
              onClick={() => send.mutate({ id: invoice.id })}
              disabled={send.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Email invoice with payment link
            </button>
          )}

          <button
            onClick={copyLink}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Link copied" : "Copy payment link"}
          </button>

          <div className="rounded-xl border border-gray-200 p-3.5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Record a payment received</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
              />
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none"
              >
                {["CARD", "ACH", "CHECK", "CASH", "WIRE", "OTHER"].map((m) => (
                  <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>
                ))}
              </select>
              <button
                onClick={() => markPaid.mutate({ id: invoice.id, amount, method: method as "CARD" | "ACH" | "CHECK" | "CASH" | "WIRE" | "OTHER" })}
                disabled={markPaid.isPending || amount <= 0}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {markPaid.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Record"}
              </button>
            </div>
          </div>

          {(send.error || markPaid.error) && (
            <p className="text-xs text-red-600">{send.error?.message ?? markPaid.error?.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

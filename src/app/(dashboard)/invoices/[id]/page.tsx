import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { format } from "date-fns";
import { formatCurrency, INVOICE_STATUS_COLORS, cn } from "@/lib/utils";
import { ArrowLeft, User, MapPin, Clock, Receipt } from "lucide-react";
import { InvoiceActions } from "@/components/invoices/invoice-actions";

export const dynamic = "force-dynamic";

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  PARTIAL: "Partial",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD: "Card",
  ACH: "ACH",
  CHECK: "Check",
  CASH: "Cash",
  WIRE: "Wire",
  OTHER: "Other",
};

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });
  const workspaceId = user!.workspaces[0].workspace.id;

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, workspaceId },
    include: {
      client: true,
      job: { select: { id: true, jobNumber: true, propertyAddress: true, propertyCity: true, propertyState: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!invoice) notFound();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={invoice.invoiceNumber}
        description={`${invoice.client.firstName} ${invoice.client.lastName}`}
        actions={
          <Link
            href="/invoices"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to invoices
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-5">

          {/* Status + actions bar */}
          <div className="bg-white rounded-xl border p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn(
                "text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border",
                INVOICE_STATUS_COLORS[invoice.status] ?? "bg-gray-100 text-gray-700 border-gray-200"
              )}>
                {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
              </span>
              <span className="text-sm text-gray-500">
                Created {format(new Date(invoice.createdAt), "MMM d, yyyy")}
              </span>
              {invoice.issuedAt && (
                <span className="text-sm text-gray-500">
                  · Sent {format(new Date(invoice.issuedAt), "MMM d, yyyy")}
                </span>
              )}
              {invoice.dueAt && (
                <span className={cn(
                  "text-sm font-medium",
                  invoice.status !== "PAID" && new Date(invoice.dueAt) < new Date()
                    ? "text-red-600"
                    : "text-gray-500"
                )}>
                  · Due {format(new Date(invoice.dueAt), "MMM d, yyyy")}
                </span>
              )}
            </div>
            <InvoiceActions invoice={{
              id: invoice.id,
              status: invoice.status,
              amountDue: invoice.amountDue,
              totalAmount: invoice.totalAmount,
            }} />
          </div>

          <div className="grid grid-cols-3 gap-5">

            {/* Left col: line items + notes */}
            <div className="col-span-2 space-y-5">

              {/* Line items */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-900">Line Items</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-5 py-3">Description</th>
                      <th className="text-right px-4 py-3">Qty</th>
                      <th className="text-right px-4 py-3">Unit Price</th>
                      <th className="text-right px-5 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoice.lineItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3.5 text-gray-800">{item.description}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-5 py-3.5 text-right font-medium text-gray-900">{formatCurrency(item.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals footer */}
                <div className="border-t px-5 py-4 space-y-2 bg-gray-50">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium text-gray-900">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.taxAmount > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Tax ({invoice.taxRate}%)</span>
                      <span className="font-medium text-gray-900">{formatCurrency(invoice.taxAmount)}</span>
                    </div>
                  )}
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Discount</span>
                      <span className="font-medium text-red-600">−{formatCurrency(invoice.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 mt-1">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-base text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                  </div>
                  {invoice.amountPaid > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Paid</span>
                      <span className="font-medium">−{formatCurrency(invoice.amountPaid)}</span>
                    </div>
                  )}
                  {invoice.amountDue > 0 && (
                    <div className="flex justify-between border-t pt-2 mt-1">
                      <span className="font-semibold text-gray-900">Balance Due</span>
                      <span className="font-bold text-base text-red-600">{formatCurrency(invoice.amountDue)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="bg-white rounded-xl border p-5">
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">Notes</h2>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}

              {/* Payment history */}
              {invoice.payments.length > 0 && (
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-5 py-4 border-b bg-gray-50">
                    <h2 className="text-sm font-semibold text-gray-900">Payment History</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-5 py-3">Date</th>
                        <th className="text-left px-4 py-3">Method</th>
                        <th className="text-right px-5 py-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoice.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-600">
                            {p.paidAt ? format(new Date(p.paidAt), "MMM d, yyyy") : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-green-600">
                            {formatCurrency(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right col: client + job */}
            <div className="space-y-5">

              {/* Client */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" /> Client
                </h2>
                <Link href={`/clients/${invoice.client.id}`} className="group block">
                  <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {invoice.client.firstName} {invoice.client.lastName}
                  </p>
                  {invoice.client.company && (
                    <p className="text-xs text-gray-500 mt-0.5">{invoice.client.company}</p>
                  )}
                </Link>
                <p className="text-xs text-gray-500 mt-1">{invoice.client.email}</p>
                {invoice.client.phone && (
                  <p className="text-xs text-gray-500">{invoice.client.phone}</p>
                )}
              </div>

              {/* Job */}
              {invoice.job && (
                <div className="bg-white rounded-xl border p-5">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" /> Job
                  </h2>
                  <Link href={`/jobs/${invoice.job.id}`} className="group block">
                    <p className="text-xs font-mono text-gray-400 mb-0.5">#{invoice.job.jobNumber}</p>
                    <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors text-sm leading-snug">
                      {invoice.job.propertyAddress}
                    </p>
                    {(invoice.job.propertyCity || invoice.job.propertyState) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[invoice.job.propertyCity, invoice.job.propertyState].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </Link>
                </div>
              )}

              {/* Timestamps */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" /> Timeline
                </h2>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Created</span>
                    <span>{format(new Date(invoice.createdAt), "MMM d, yyyy")}</span>
                  </div>
                  {invoice.issuedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sent</span>
                      <span>{format(new Date(invoice.issuedAt), "MMM d, yyyy")}</span>
                    </div>
                  )}
                  {invoice.dueAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Due</span>
                      <span className={
                        invoice.status !== "PAID" && new Date(invoice.dueAt) < new Date()
                          ? "text-red-600 font-semibold"
                          : ""
                      }>
                        {format(new Date(invoice.dueAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  )}
                  {invoice.paidAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Paid</span>
                      <span className="text-green-600 font-semibold">
                        {format(new Date(invoice.paidAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

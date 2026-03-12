"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn, formatCurrency, formatDate, INVOICE_STATUS_COLORS } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Eye, Send, Check, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/trpc/client";

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  PARTIAL: "Partial",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  amountDue: number;
  amountPaid: number;
  dueAt?: Date | null;
  createdAt: Date;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  job?: {
    id: string;
    jobNumber: string;
    propertyAddress: string;
  } | null;
};

interface InvoicesTableProps {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export function InvoicesTable({ invoices, total, page, limit }: InvoicesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / limit);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");

  const sendMutation = api.invoices.send.useMutation();
  const markPaidMutation = api.invoices.markPaid.useMutation();
  const voidMutation = api.invoices.void.useMutation();

  // Calculate stats
  const stats = useMemo(() => {
    const outstanding = invoices
      .filter(inv => ["DRAFT", "SENT", "VIEWED", "PARTIAL", "OVERDUE"].includes(inv.status))
      .reduce((sum, inv) => sum + inv.amountDue, 0);

    const overdue = invoices.filter(inv => inv.status === "OVERDUE").length;
    const paidThisMonth = invoices
      .filter(inv => {
        if (inv.status !== "PAID") return false;
        const now = new Date();
        const invoiceDate = new Date(inv.createdAt);
        return invoiceDate.getMonth() === now.getMonth() &&
          invoiceDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, inv) => sum + inv.totalAmount, 0);

    return { outstanding, overdue, paidThisMonth };
  }, [invoices]);

  function changePage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`?${params.toString()}`);
  }

  function setStatus(value: string) {
    setStatusFilter(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  async function handleSend(invoiceId: string) {
    try {
      await sendMutation.mutateAsync({ id: invoiceId });
      router.refresh();
    } catch (error) {
      console.error("Failed to send invoice:", error);
    }
  }

  async function handleMarkPaid(invoiceId: string, amountDue: number) {
    try {
      await markPaidMutation.mutateAsync({
        id: invoiceId,
        amount: amountDue,
      });
      router.refresh();
    } catch (error) {
      console.error("Failed to mark invoice as paid:", error);
    }
  }

  async function handleVoid(invoiceId: string) {
    try {
      await voidMutation.mutateAsync({ id: invoiceId });
      router.refresh();
    } catch (error) {
      console.error("Failed to void invoice:", error);
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">📄</div>
        <p className="text-base font-semibold text-gray-700">No invoices found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try changing your filters or create a new invoice.
        </p>
        <Link
          href="/invoices/new"
          className="mt-4 text-sm font-medium text-blue-600 hover:underline"
        >
          + Create your first invoice
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Outstanding</p>
          <p className="text-xl font-semibold text-gray-900">{formatCurrency(stats.outstanding)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Overdue</p>
          <p className="text-xl font-semibold text-red-600">{stats.overdue}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Paid This Month</p>
          <p className="text-xl font-semibold text-green-600">{formatCurrency(stats.paidThisMonth)}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { value: "", label: "All" },
          { value: "DRAFT", label: "Draft" },
          { value: "SENT", label: "Sent" },
          { value: "PAID", label: "Paid" },
          { value: "OVERDUE", label: "Overdue" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              statusFilter === tab.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Address</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Due Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-gray-900 font-medium">
                      {invoice.client.firstName} {invoice.client.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{invoice.client.email}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-gray-600 text-sm">
                      {invoice.job?.propertyAddress || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(invoice.totalAmount)}
                    </p>
                    {invoice.amountDue > 0 && (
                      <p className="text-xs text-red-600">
                        {formatCurrency(invoice.amountDue)} due
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border",
                        INVOICE_STATUS_COLORS[invoice.status] || "bg-gray-100 text-gray-800"
                      )}
                    >
                      {INVOICE_STATUS_LABELS[invoice.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-gray-600 text-sm">
                      {invoice.dueAt ? formatDate(invoice.dueAt) : "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="View"
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {invoice.status === "DRAFT" && (
                        <button
                          onClick={() => handleSend(invoice.id)}
                          title="Send"
                          disabled={sendMutation.isPending}
                          className="p-1.5 hover:bg-blue-100 rounded text-blue-600 hover:text-blue-900 transition-colors disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      {invoice.amountDue > 0 && invoice.status !== "VOID" && (
                        <button
                          onClick={() => handleMarkPaid(invoice.id, invoice.amountDue)}
                          title="Mark Paid"
                          disabled={markPaidMutation.isPending}
                          className="p-1.5 hover:bg-green-100 rounded text-green-600 hover:text-green-900 transition-colors disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      {invoice.status !== "PAID" && invoice.status !== "VOID" && (
                        <button
                          onClick={() => handleVoid(invoice.id)}
                          title="Void"
                          disabled={voidMutation.isPending}
                          className="p-1.5 hover:bg-red-100 rounded text-red-600 hover:text-red-900 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => changePage(page - 1)}
                disabled={page === 1}
                className="flex items-center justify-center h-7 w-7 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-xs font-medium text-gray-700">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => changePage(page + 1)}
                disabled={page === totalPages}
                className="flex items-center justify-center h-7 w-7 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

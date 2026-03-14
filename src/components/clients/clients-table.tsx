"use client";

import Link from "next/link";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Send, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const CLIENT_TYPE_COLORS: Record<string, string> = {
  AGENT: "bg-blue-100 text-blue-800",
  BROKER: "bg-purple-100 text-purple-800",
  BUILDER: "bg-orange-100 text-orange-800",
  HOMEOWNER: "bg-green-100 text-green-800",
  PROPERTY_MANAGER: "bg-indigo-100 text-indigo-800",
  OTHER: "bg-gray-100 text-gray-800",
};

const CLIENT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  BLOCKED: "bg-red-100 text-red-800",
};

type Client = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  type: string;
  status: string;
  totalJobs: number;
  totalRevenue: number;
  lastJobAt?: Date | null;
  portalAccessedAt?: Date | null;
};

interface ClientsTableProps {
  clients: Client[];
  total: number;
  page: number;
  limit: number;
}

function InlineInviteButton({ clientId }: { clientId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "sent">("idle");

  async function send(e: React.MouseEvent) {
    e.stopPropagation(); // don't navigate to client detail
    setState("loading");
    try {
      const res = await fetch("/api/portal/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) throw new Error();
      setState("sent");
    } catch {
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700">
        <CheckCircle2 className="w-3 h-3" />
        Sent
      </span>
    );
  }

  return (
    <button
      onClick={send}
      disabled={state === "loading"}
      className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
    >
      {state === "loading" ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Send className="w-3 h-3" />
      )}
      Invite
    </button>
  );
}

export function ClientsTable({ clients, total, page, limit }: ClientsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / limit);

  function changePage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`?${params.toString()}`);
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">👥</div>
        <p className="text-base font-semibold text-gray-700">No clients found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try changing your filters or create a new client.
        </p>
        <Link
          href="/clients/new"
          className="mt-4 text-sm font-medium text-blue-600 hover:underline"
        >
          + Create your first client
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Company</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Type</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Total Jobs</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Revenue</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Last Job</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Portal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.map((client) => (
              <tr
                key={client.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/clients/${client.id}`)}
              >
                <td className="px-4 py-3.5">
                  <p className="font-medium text-gray-900">
                    {client.firstName} {client.lastName}
                  </p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-gray-600">{client.company || "—"}</p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-gray-600 text-sm">{client.email}</p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-gray-600 text-sm">{client.phone || "—"}</p>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={cn(
                      "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border",
                      CLIENT_TYPE_COLORS[client.type]
                    )}
                  >
                    {client.type}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <p className="font-medium text-gray-900">{client.totalJobs}</p>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <p className="font-medium text-gray-900">{formatCurrency(client.totalRevenue)}</p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-gray-600 text-sm">
                    {client.lastJobAt ? formatDate(client.lastJobAt) : "—"}
                  </p>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={cn(
                      "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full",
                      CLIENT_STATUS_COLORS[client.status]
                    )}
                  >
                    {client.status}
                  </span>
                </td>
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  {client.portalAccessedAt ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Active
                    </span>
                  ) : (
                    <InlineInviteButton clientId={client.id} />
                  )}
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
  );
}

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import { Building2, Loader2, Mail, Phone, Plus, Search, User, Users, X } from "lucide-react";
import { ChangeClientButton } from "./order-edit";

/**
 * Client card for the order Overview: primary client (changeable), additional
 * clients, outstanding balance, and an attached client team.
 */

export interface OrderClientInfo {
  id: string;
  name: string;
  initials: string;
  company: string | null;
  email: string;
  phone: string | null;
}

interface OrderClientsCardProps {
  jobId: string;
  primary: OrderClientInfo;
  additional: { clientId: string; name: string; email: string }[];
  /** unpaid balance across the primary client's invoices */
  balance: number;
  ordersCount: number;
  teamId: string | null;
  teams: { id: string; name: string }[];
}

export function OrderClientsCard({
  jobId,
  primary,
  additional,
  balance,
  ordersCount,
  teamId,
  teams,
}: OrderClientsCardProps) {
  const router = useRouter();
  const [addingClient, setAddingClient] = useState(false);

  const removeClient = trpc.jobs.removeOrderClient.useMutation({
    onSuccess: () => router.refresh(),
  });
  const setTeam = trpc.jobs.setOrderTeam.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-gray-900">Client</h2>
        <div className="flex items-center gap-3">
          <ChangeClientButton jobId={jobId} />
          <Link href={`/clients/${primary.id}`} className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
            View client
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
          {primary.initials}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-900">{primary.name}</p>
          {primary.company && (
            <p className="flex items-center gap-1 text-[11px] text-gray-400">
              <Building2 className="h-3 w-3" /> {primary.company}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-[12px] text-gray-500">
        <a href={`mailto:${primary.email}`} className="flex items-center gap-2 transition-colors hover:text-blue-600">
          <Mail className="h-3 w-3 shrink-0 text-gray-300" />
          <span className="truncate">{primary.email}</span>
        </a>
        {primary.phone && (
          <a href={`tel:${primary.phone}`} className="flex items-center gap-2 transition-colors hover:text-blue-600">
            <Phone className="h-3 w-3 text-gray-300" /> {primary.phone}
          </a>
        )}
        <p className="flex items-center gap-2">
          <User className="h-3 w-3 text-gray-300" />
          {ordersCount === 1 ? "First order" : `${ordersCount} orders with you`}
        </p>
        <p className="flex items-center justify-between">
          <span>Balance</span>
          <span className={cn("font-medium", balance > 0 ? "text-amber-700" : "text-emerald-700")}>
            {balance > 0 ? `${formatCurrency(balance)} outstanding` : "Paid up"}
          </span>
        </p>
      </div>

      {/* Additional clients */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Also on this order</p>
          <button
            onClick={() => setAddingClient(true)}
            className="flex items-center gap-1 text-[12px] font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            <Plus className="h-3 w-3" /> Add client
          </button>
        </div>
        {additional.length === 0 ? (
          <p className="text-[12px] text-gray-400">Just {primary.name.split(" ")[0]}.</p>
        ) : (
          <div className="space-y-1">
            {additional.map((c) => (
              <div key={c.clientId} className="group flex items-center justify-between gap-2 text-[12px]">
                <span className="min-w-0 truncate text-gray-700">{c.name} <span className="text-gray-400">· {c.email}</span></span>
                <button
                  onClick={() => removeClient.mutate({ jobId, clientId: c.clientId })}
                  disabled={removeClient.isPending}
                  title="Remove from order"
                  className="rounded p-0.5 text-gray-200 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
          <Users className="h-3 w-3" /> Team
        </p>
        {teams.length === 0 ? (
          <p className="text-[12px] text-gray-400">
            No client teams yet — create one from a client&apos;s page.
          </p>
        ) : (
          <select
            value={teamId ?? ""}
            onChange={(e) => setTeam.mutate({ jobId, customerTeamId: e.target.value || null })}
            disabled={setTeam.isPending}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-700 outline-none disabled:opacity-50"
          >
            <option value="">No team attached</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      {addingClient && (
        <AddClientModal
          jobId={jobId}
          excludeIds={[primary.id, ...additional.map((a) => a.clientId)]}
          onClose={() => setAddingClient(false)}
        />
      )}
    </section>
  );
}

function AddClientModal({
  jobId,
  excludeIds,
  onClose,
}: {
  jobId: string;
  excludeIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const clients = trpc.clients.list.useQuery(
    { search: search || undefined, limit: 8 },
    { placeholderData: (prev) => prev }
  );
  const add = trpc.jobs.addOrderClient.useMutation({
    onSuccess: () => {
      onClose();
      router.refresh();
    },
  });

  const rows = (clients.data?.clients ?? []).filter((c) => !excludeIds.includes(c.id));

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-sm font-semibold text-gray-900">Add a client to this order</h2>
          <button onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-600">×</button>
        </div>
        <div className="p-5">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {rows.map((c) => (
              <button
                key={c.id}
                onClick={() => add.mutate({ jobId, clientId: c.id })}
                disabled={add.isPending}
                className="flex w-full items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                  {c.firstName?.[0]}{c.lastName?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                  <p className="truncate text-xs text-gray-400">{c.company ? `${c.company} · ` : ""}{c.email}</p>
                </div>
                {add.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-300" />}
              </button>
            ))}
            {clients.data && rows.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">No other clients found.</p>
            )}
          </div>
          {add.error && <p className="mt-2 text-xs text-red-600">{add.error.message}</p>}
        </div>
      </div>
    </div>,
    document.body
  );
}

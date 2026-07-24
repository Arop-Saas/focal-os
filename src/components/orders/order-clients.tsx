"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import { Building2, Loader2, Mail, Phone, Plus, Search, User, Users, X } from "lucide-react";

/**
 * Client card for the order Overview. Two modes:
 *  - Individual: the primary client (+ optional additional clients)
 *  - Team: an attached CustomerTeam IS the client — the card shows the team,
 *    its members, and which member is the primary (billing/email) contact.
 */

export interface OrderClientInfo {
  id: string;
  name: string;
  initials: string;
  company: string | null;
  email: string;
  phone: string | null;
}

export interface TeamInfo {
  id: string;
  name: string;
  members: { id: string; name: string; email: string }[];
}

interface OrderClientsCardProps {
  jobId: string;
  primary: OrderClientInfo | null;
  additional: { clientId: string; name: string; email: string }[];
  /** unpaid balance — the team's combined balance in team mode */
  balance: number;
  ordersCount: number;
  team: TeamInfo | null;
  teams: { id: string; name: string }[];
}

export function OrderClientsCard({
  jobId,
  primary,
  additional,
  balance,
  ordersCount,
  team,
  teams,
}: OrderClientsCardProps) {
  const router = useRouter();
  const [addingClient, setAddingClient] = useState(false);
  const [changing, setChanging] = useState(false);

  const removeClient = trpc.jobs.removeOrderClient.useMutation({
    onSuccess: () => router.refresh(),
  });
  const setTeam = trpc.jobs.setOrderTeam.useMutation({
    onSuccess: () => router.refresh(),
  });
  const setPrimary = trpc.jobs.updateDetails.useMutation({
    onSuccess: () => router.refresh(),
  });
  const removePrimary = trpc.jobs.removePrimaryClient.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-gray-900">Client</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setChanging(true)}
            className="text-[12px] font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            Change
          </button>
          {primary && (
            <Link href={`/clients/${primary.id}`} className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
              View client
            </Link>
          )}
        </div>
      </div>

      {team ? (
        /* ── Team mode — the team is the client ── */
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-900">{team.name}</p>
              <p className="text-[11px] text-gray-400">
                {team.members.length} member{team.members.length !== 1 ? "s" : ""} · team
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            {(!primary || team.members.some((m) => m.id === primary.id)
              ? team.members
              : [{ id: primary.id, name: primary.name, email: primary.email }, ...team.members]
            ).map((m) => {
              const isPrimary = m.id === primary?.id;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2",
                    isPrimary ? "bg-blue-50/70" : "hover:bg-gray-50"
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[13px] text-gray-800">
                      {m.name}
                      {isPrimary && (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                          Primary contact
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-gray-400">{m.email}</p>
                  </div>
                  {!isPrimary && (
                    <button
                      onClick={() => setPrimary.mutate({ jobId, clientId: m.id })}
                      disabled={setPrimary.isPending}
                      className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-500 opacity-0 transition-all hover:border-blue-300 hover:text-blue-600 group-hover:opacity-100"
                    >
                      Make primary
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 text-[12px] text-gray-500">
            <p className="flex items-center justify-between">
              <span>Team balance</span>
              <span className={cn("font-medium", balance > 0 ? "text-amber-700" : "text-emerald-700")}>
                {balance > 0 ? `${formatCurrency(balance)} outstanding` : "Paid"}
              </span>
            </p>
            <button
              onClick={() => setTeam.mutate({ jobId, customerTeamId: null })}
              disabled={setTeam.isPending}
              className="text-[11px] font-medium text-gray-400 transition-colors hover:text-red-500"
            >
              Detach team from this order
            </button>
          </div>
        </>
      ) : (
        /* ── Individual mode ── */
        !primary ? (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center">
            <p className="text-[13px] font-medium text-gray-500">No client on this order</p>
            <p className="mt-0.5 text-[11px] text-gray-400">Invoicing and delivery emails need a client.</p>
            <button
              onClick={() => setChanging(true)}
              className="mt-2.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-700"
            >
              Add client
            </button>
          </div>
        ) : (
        <>
          <div className="group/primary flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {primary.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-gray-900">{primary.name}</p>
              {primary.company && (
                <p className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Building2 className="h-3 w-3" /> {primary.company}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                if (confirm(`Remove ${primary.name} from this order?${additional.length > 0 ? " The next client becomes primary." : " The order will have no client."}`)) {
                  removePrimary.mutate({ jobId });
                }
              }}
              disabled={removePrimary.isPending}
              title="Remove client from order"
              className="shrink-0 rounded p-1 text-gray-200 opacity-0 transition-all hover:text-red-500 group-hover/primary:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
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
                {balance > 0 ? `${formatCurrency(balance)} outstanding` : "Paid"}
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
        </>
        )
      )}

      {addingClient && (
        <ClientPickerModal
          title="Add a client to this order"
          excludeIds={[...(primary ? [primary.id] : []), ...additional.map((a) => a.clientId)]}
          onPick={(clientId) => ({ kind: "ADD" as const, clientId })}
          jobId={jobId}
          teams={[]}
          onClose={() => setAddingClient(false)}
        />
      )}
      {changing && (
        <ClientPickerModal
          title="Change client"
          excludeIds={[]}
          onPick={(clientId) => ({ kind: "PRIMARY" as const, clientId })}
          jobId={jobId}
          teams={teams}
          onClose={() => setChanging(false)}
        />
      )}
    </section>
  );
}

/** Shared picker: clients (search or create) and — for the Change flow —
 * teams, so a whole team can be made the client of the order. */
function ClientPickerModal({
  jobId,
  title,
  excludeIds,
  teams,
  onPick,
  onClose,
}: {
  jobId: string;
  title: string;
  excludeIds: string[];
  teams: { id: string; name: string }[];
  onPick: (clientId: string) => { kind: "ADD" | "PRIMARY"; clientId: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [nc, setNc] = useState({ first: "", last: "", email: "", phone: "" });

  const clients = trpc.clients.list.useQuery(
    { search: search || undefined, limit: 8 },
    { placeholderData: (prev) => prev }
  );

  const done = () => {
    onClose();
    router.refresh();
  };
  const addClient = trpc.jobs.addOrderClient.useMutation({ onSuccess: done });
  const setPrimary = trpc.jobs.updateDetails.useMutation({ onSuccess: done });
  const setTeam = trpc.jobs.setOrderTeam.useMutation({ onSuccess: done });
  const createClient = trpc.clients.create.useMutation({
    onSuccess: (created) => pick(created.id),
  });

  const pick = (clientId: string) => {
    const action = onPick(clientId);
    if (action.kind === "ADD") addClient.mutate({ jobId, clientId });
    else setPrimary.mutate({ jobId, clientId });
  };

  const busy = addClient.isPending || setPrimary.isPending || setTeam.isPending || createClient.isPending;
  const err = addClient.error ?? setPrimary.error ?? setTeam.error ?? createClient.error;
  const rows = (clients.data?.clients ?? []).filter((c) => !excludeIds.includes(c.id));
  const q = search.trim().toLowerCase();
  const teamRows = teams.filter((t) => !q || t.name.toLowerCase().includes(q));
  const ncValid = nc.first.trim() && nc.last.trim() && /^\S+@\S+\.\S+$/.test(nc.email.trim());
  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-600">×</button>
        </div>
        <div className="p-5">
          {!creating ? (
            <>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={teams.length > 0 ? "Search clients and teams…" : "Search clients…"}
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {teamRows.length > 0 && (
                  <>
                    <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Teams</p>
                    {teamRows.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTeam.mutate({ jobId, customerTeamId: t.id })}
                        disabled={busy}
                        className="flex w-full items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          <Users className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{t.name}</p>
                      </button>
                    ))}
                    <p className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Clients</p>
                  </>
                )}
                {rows.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pick(c.id)}
                    disabled={busy}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                      {c.firstName?.[0]}{c.lastName?.[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                      <p className="truncate text-xs text-gray-400">{c.company ? `${c.company} · ` : ""}{c.email}</p>
                    </div>
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-300" />}
                  </button>
                ))}
                {clients.data && rows.length === 0 && teamRows.length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-400">Nothing found.</p>
                )}
              </div>
              <button
                onClick={() => setCreating(true)}
                className="mt-3 w-full rounded-xl border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600"
              >
                + Create new client
              </button>
            </>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input value={nc.first} onChange={(e) => setNc((v) => ({ ...v, first: e.target.value }))} placeholder="First name" className={inputCls} />
                <input value={nc.last} onChange={(e) => setNc((v) => ({ ...v, last: e.target.value }))} placeholder="Last name" className={inputCls} />
              </div>
              <input value={nc.email} onChange={(e) => setNc((v) => ({ ...v, email: e.target.value }))} type="email" placeholder="Email" className={inputCls} />
              <input value={nc.phone} onChange={(e) => setNc((v) => ({ ...v, phone: e.target.value }))} type="tel" placeholder="Phone (optional)" className={inputCls} />
              <div className="flex gap-2 pt-1">
                <button onClick={() => setCreating(false)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Back
                </button>
                <button
                  onClick={() => ncValid && createClient.mutate({ firstName: nc.first.trim(), lastName: nc.last.trim(), email: nc.email.trim(), phone: nc.phone.trim() || undefined })}
                  disabled={!ncValid || busy}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create & use"}
                </button>
              </div>
            </div>
          )}
          {err && <p className="mt-2 text-xs text-red-600">{err.message}</p>}
        </div>
      </div>
    </div>,
    document.body
  );
}

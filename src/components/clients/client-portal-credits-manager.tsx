"use client";

/**
 * S8 — admin controls for the two new client-level systems:
 *  - portal sessions: see active devices, revoke all access instantly (R8)
 *  - credits: grant/adjust with a reason, full ledger (B9)
 */
import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { ShieldOff, Loader2, Wallet, Plus, Minus, CheckCircle } from "lucide-react";

export function ClientPortalCreditsManager({ clientId }: { clientId: string }) {
  const utils = api.useUtils();

  // ── Portal sessions ─────────────────────────────────────────────────────
  const sessionsQuery = api.clients.listPortalSessions.useQuery({ clientId });
  const revokeMutation = api.clients.revokePortalAccess.useMutation({
    onSuccess: () => void utils.clients.listPortalSessions.invalidate({ clientId }),
  });
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const activeSessions = sessionsQuery.data?.sessions.filter((s) => s.active) ?? [];

  // ── Credits ─────────────────────────────────────────────────────────────
  const creditsQuery = api.clients.listCredits.useQuery({ clientId, limit: 10 });
  const grantMutation = api.clients.grantCredit.useMutation({
    onSuccess: () => {
      setAmount("");
      setReason("");
      setGrantOk(true);
      setTimeout(() => setGrantOk(false), 2500);
      void utils.clients.listCredits.invalidate({ clientId });
    },
  });
  const [mode, setMode] = useState<"grant" | "deduct">("grant");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [grantOk, setGrantOk] = useState(false);

  const parsedAmount = parseFloat(amount);
  const canSubmit =
    !Number.isNaN(parsedAmount) && parsedAmount > 0 && reason.trim().length > 0 && !grantMutation.isPending;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* ── Portal security ── */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Portal Sessions</h2>
        {sessionsQuery.isLoading ? (
          <div className="py-4 flex justify-center text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-3">
              {activeSessions.length === 0
                ? "No active portal sessions."
                : `${activeSessions.length} active session${activeSessions.length !== 1 ? "s" : ""}.`}
            </p>
            {activeSessions.length > 0 && (
              <ul className="space-y-1.5 mb-4">
                {activeSessions.slice(0, 5).map((s) => (
                  <li key={s.id} className="text-xs text-gray-500 flex items-center justify-between gap-2">
                    <span className="truncate">
                      {s.userAgent ? s.userAgent.split(")")[0].split("(").pop() ?? "Unknown device" : "Unknown device"}
                    </span>
                    <span className="text-gray-400 shrink-0">
                      {s.lastSeenAt
                        ? `seen ${new Date(s.lastSeenAt).toLocaleDateString()}`
                        : `since ${new Date(s.createdAt).toLocaleDateString()}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!confirmRevoke ? (
              <button
                type="button"
                onClick={() => setConfirmRevoke(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5"
              >
                <ShieldOff className="w-3.5 h-3.5" /> Revoke portal access
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={revokeMutation.isPending}
                  onClick={() => {
                    revokeMutation.mutate({ clientId });
                    setConfirmRevoke(false);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  {revokeMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  Yes — sign them out everywhere
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
            {revokeMutation.isSuccess && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> All sessions revoked — magic links issued earlier are dead too.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Credits ── */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-900">Credits</h2>
          <span className="text-sm font-bold text-green-600 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" />
            {creditsQuery.data ? formatCurrency(creditsQuery.data.balance) : "—"}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Credits apply automatically to the client&apos;s next invoice.
        </p>

        <div className="flex gap-2 mb-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setMode("grant")}
              className={`px-2.5 py-1.5 text-xs font-medium ${mode === "grant" ? "bg-green-50 text-green-700" : "text-gray-500"}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMode("deduct")}
              className={`px-2.5 py-1.5 text-xs font-medium ${mode === "deduct" ? "bg-red-50 text-red-700" : "text-gray-500"}`}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <input
            type="text"
            placeholder={mode === "grant" ? "Reason (e.g. referral bonus)" : "Reason for deduction"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              grantMutation.mutate({
                clientId,
                amount: mode === "grant" ? parsedAmount : -parsedAmount,
                reason: reason.trim(),
              })
            }
            className="text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg px-3 py-1.5 disabled:opacity-40"
          >
            {grantMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
          </button>
        </div>
        {grantMutation.error && (
          <p className="text-xs text-red-600 mb-2">{grantMutation.error.message}</p>
        )}
        {grantOk && (
          <p className="text-xs text-green-600 mb-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Balance updated
          </p>
        )}

        {creditsQuery.data && creditsQuery.data.entries.length > 0 && (
          <ul className="divide-y divide-gray-50 max-h-36 overflow-y-auto">
            {creditsQuery.data.entries.map((e) => (
              <li key={e.id} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-600 truncate">{e.reason ?? "—"}</span>
                <span className="shrink-0 text-gray-400">
                  {new Date(e.createdAt).toLocaleDateString()}
                </span>
                <span className={`shrink-0 font-semibold ${e.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                  {e.amount > 0 ? "+" : ""}
                  {formatCurrency(e.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

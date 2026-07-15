"use client";

/**
 * S7: Time off — photographers finally get vacations.
 * Entries block slots in the scheduling engine (client booking, admin
 * assignment, reschedules) the moment they're added.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { format } from "date-fns";
import { Palmtree, Plus, Trash2 } from "lucide-react";

export function TimeOffManager() {
  const utils = trpc.useUtils();
  const staffQuery = trpc.staff.list.useQuery();
  const listQuery = trpc.availability.listTimeOff.useQuery({});
  const addMutation = trpc.availability.addTimeOff.useMutation({
    onSuccess: () => { utils.availability.listTimeOff.invalidate(); setStart(""); setEnd(""); setReason(""); },
  });
  const removeMutation = trpc.availability.removeTimeOff.useMutation({
    onSuccess: () => utils.availability.listTimeOff.invalidate(),
  });

  const [staffId, setStaffId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const staffOptions = (staffQuery.data ?? [])
    .filter((m: { staffProfile?: { id: string } | null }) => m.staffProfile?.id)
    .map((m: { staffProfile?: { id: string } | null; user?: { fullName?: string | null; email?: string | null } | null }) => ({
      id: m.staffProfile!.id,
      name: m.user?.fullName ?? m.user?.email ?? "Team member",
    }));

  const canAdd = staffId && start && end && new Date(end) > new Date(start);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
          <Palmtree className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Time off</h2>
          <p className="text-xs text-gray-500">Vacations and personal blocks — booked slots around them disappear automatically.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-4">
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
          className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Team member…</option>
          {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)}
          className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)}
          className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)"
          className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button
          onClick={() => canAdd && addMutation.mutate({ staffProfileId: staffId, startsAt: new Date(start), endsAt: new Date(end), reason: reason || undefined })}
          disabled={!canAdd || addMutation.isPending}
          className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-lg">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      {addMutation.error && <p className="text-xs text-red-600 mb-3">{addMutation.error.message}</p>}

      <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg overflow-hidden">
        {listQuery.isLoading ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : (listQuery.data?.length ?? 0) === 0 ? (
          <p className="p-4 text-sm text-gray-400">No upcoming time off.</p>
        ) : (
          listQuery.data!.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium text-gray-800 w-40 truncate">
                {t.staff?.member?.user?.fullName ?? "Team member"}
              </span>
              <span className="flex-1 text-gray-500 text-xs">
                {format(new Date(t.startsAt), "MMM d, h:mm a")} → {format(new Date(t.endsAt), "MMM d, h:mm a")}
                {t.reason ? <span className="text-gray-400"> · {t.reason}</span> : null}
              </span>
              <button onClick={() => removeMutation.mutate({ id: t.id })}
                className="text-gray-300 hover:text-red-500 transition-colors" aria-label="remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * S8 — client self-service reschedule.
 * Small button on eligible portal order cards → date picker → engine slots →
 * confirm. Server enforces every rule again; this UI is just a nice hallway.
 */
import { useState } from "react";
import { CalendarClock, Loader2, X } from "lucide-react";

interface Props {
  workspaceSlug: string;
  jobId: string;
  scheduledAtISO: string;
  timezone: string;
  brandColor: string;
}

function fmtInTz(iso: string, timezone: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: timezone }).format(new Date(iso));
}

export function PortalRescheduleButton({
  workspaceSlug,
  jobId,
  scheduledAtISO,
  timezone,
  brandColor,
}: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() =>
    // default the picker to the currently scheduled day, in workspace TZ
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(scheduledAtISO))
  );
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const loadSlots = async (d: string) => {
    setLoadingSlots(true);
    setError(null);
    setSelected(null);
    setSlots(null);
    try {
      const res = await fetch(
        `/api/portal/reschedule/slots?slug=${encodeURIComponent(workspaceSlug)}&jobId=${encodeURIComponent(jobId)}&date=${d}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load times");
      setSlots(data.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load times");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: workspaceSlug, jobId, scheduledAt: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reschedule failed");
      setDone(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reschedule failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <span className="text-xs font-medium text-green-600">
        Moved to {fmtInTz(done, timezone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        {" — "}confirmation email on its way
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (!slots) void loadSlots(date);
        }}
        className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors"
      >
        <CalendarClock className="w-3.5 h-3.5" /> Reschedule
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-gray-900">Reschedule shoot</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Currently{" "}
              {fmtInTz(scheduledAtISO, timezone, {
                weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })}
              . Times shown in {timezone.replace(/_/g, " ")}.
            </p>

            <label className="block text-xs font-medium text-gray-600 mb-1">New date</label>
            <input
              type="date"
              value={date}
              min={new Intl.DateTimeFormat("en-CA").format(new Date(Date.now() + 25 * 3600e3))}
              onChange={(e) => {
                setDate(e.target.value);
                if (e.target.value) void loadSlots(e.target.value);
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />

            <div className="min-h-[96px]">
              {loadingSlots ? (
                <div className="flex items-center justify-center py-6 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : slots && slots.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {slots.map((iso) => (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelected(iso)}
                      className={`text-xs font-medium rounded-lg px-2 py-2 border transition-colors ${
                        selected === iso
                          ? "text-white border-transparent"
                          : "text-gray-700 border-gray-200 hover:border-gray-300"
                      }`}
                      style={selected === iso ? { backgroundColor: brandColor } : undefined}
                    >
                      {fmtInTz(iso, timezone, { hour: "numeric", minute: "2-digit" })}
                    </button>
                  ))}
                </div>
              ) : slots ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  No openings that day — try another date.
                </p>
              ) : null}
            </div>

            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

            <button
              type="button"
              disabled={!selected || submitting}
              onClick={() => void submit()}
              className="w-full mt-4 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: brandColor }}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm new time
            </button>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              Changes less than 24 hours before a shoot need a call to the studio.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

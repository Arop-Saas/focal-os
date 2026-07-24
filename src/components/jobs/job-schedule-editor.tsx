"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar, Pencil, CalendarX, Loader2, Check } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface JobScheduleEditorProps {
  jobId: string;
  scheduledAt: Date | null;
  estimatedDurationMins: number;
}

export function JobScheduleEditor({ jobId, scheduledAt, estimatedDurationMins }: JobScheduleEditorProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"schedule" | "postpone">("schedule");

  // datetime-local input expects "YYYY-MM-DDTHH:mm"
  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const defaultValue = scheduledAt
    ? toLocalInput(new Date(scheduledAt))
    : toLocalInput((() => {
        const d = new Date();
        d.setHours(9, 0, 0, 0);
        d.setDate(d.getDate() + 1);
        return d;
      })());

  const [dateValue, setDateValue] = useState(defaultValue);
  const [saved, setSaved] = useState(false);

  const updateMutation = trpc.jobs.update.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setShowModal(false);
        router.refresh();
      }, 1200);
    },
  });

  const handleSave = () => {
    if (mode === "postpone") {
      updateMutation.mutate({ id: jobId, scheduledAt: null });
    } else {
      const d = new Date(dateValue);
      if (isNaN(d.getTime())) return;
      updateMutation.mutate({ id: jobId, scheduledAt: d });
    }
  };

  // Golden-hour hint when this order has a twilight visit
  const dateISO = dateValue?.slice(0, 10) ?? "";
  const twilight = trpc.jobs.twilightWindow.useQuery(
    { jobId, dateISO },
    { enabled: showModal && mode === "schedule" && /^\d{4}-\d{2}-\d{2}$/.test(dateISO) }
  );
  const fmtT = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const openSchedule = () => {
    setMode("schedule");
    setDateValue(scheduledAt ? toLocalInput(new Date(scheduledAt)) : defaultValue);
    setSaved(false);
    setShowModal(true);
  };

  const openPostpone = () => {
    setMode("postpone");
    setSaved(false);
    setShowModal(true);
  };

  return (
    <>
      {/* Inline display + action buttons */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Scheduled</p>
          <p className="font-medium text-gray-900">
            {scheduledAt
              ? format(new Date(scheduledAt), "EEEE, MMM d, yyyy")
              : <span className="text-gray-400 italic">Not scheduled</span>}
          </p>
          {scheduledAt && (
            <p className="text-gray-600">{format(new Date(scheduledAt), "h:mm a")}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Duration</p>
          <p className="text-gray-700">{estimatedDurationMins} min estimated</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3 pt-3 border-t">
        <button
          onClick={openSchedule}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Pencil className="h-3 w-3" />
          {scheduledAt ? "Reschedule" : "Schedule"}
        </button>
        {scheduledAt && (
          <button
            onClick={openPostpone}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <CalendarX className="h-3 w-3" />
            Postpone
          </button>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <h2 className="font-semibold text-gray-900 text-sm">
                  {mode === "postpone" ? "Postpone Job" : scheduledAt ? "Reschedule Job" : "Schedule Job"}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-5">
              {mode === "postpone" ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <p className="font-medium mb-1">Remove scheduled date?</p>
                  <p className="text-xs text-amber-700">
                    The job will remain in your pipeline but without a scheduled time. You can reschedule it later.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    New date & time
                  </label>
                  <input
                    type="datetime-local"
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {twilight.data?.hasSolar && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        This order includes a twilight visit — on this date, sunset at the
                        property is <span className="font-semibold">{fmtT(twilight.data.sunset)}</span>;
                        golden hour starts <span className="font-semibold">{fmtT(twilight.data.suggestedStart)}</span>.
                      </p>
                      {twilight.data.primaryIsSolar && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!twilight.data?.hasSolar) return;
                            const d = new Date(twilight.data.suggestedStart);
                            const pad = (n: number) => String(n).padStart(2, "0");
                            setDateValue(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                          }}
                          className="shrink-0 rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-700"
                        >
                          Use
                        </button>
                      )}
                    </div>
                  )}
                  {dateValue && (
                    <p className="text-xs text-gray-500">
                      {(() => {
                        const d = new Date(dateValue);
                        return isNaN(d.getTime()) ? "" : format(d, "EEEE, MMMM d, yyyy 'at' h:mm a");
                      })()}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending || saved}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5",
                  saved
                    ? "bg-green-600 text-white"
                    : mode === "postpone"
                    ? "bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60"
                    : "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                )}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saved ? (
                  <><Check className="h-3.5 w-3.5" /> Saved!</>
                ) : mode === "postpone" ? (
                  "Confirm Postpone"
                ) : scheduledAt ? (
                  "Confirm Reschedule"
                ) : (
                  "Schedule Job"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

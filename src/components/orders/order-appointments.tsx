"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Calendar, CalendarX, Check, Loader2, Pencil, XCircle,
  Sun, Cloud, CloudRain, CloudSnow, CloudSun, CloudLightning, CloudFog,
} from "lucide-react";
import { DIM_BADGE, APPOINTMENT_STATUS_META } from "./status-meta";
import { JobAssignmentPicker } from "@/components/jobs/job-assignment-picker";

/**
 * Per-appointment scheduling blocks for the order Overview — each appointment
 * gets the full "Scheduled / Duration / Photographer + actions" treatment,
 * with reschedule, postpone and cancel on every one, and a weather chip for
 * scheduled dates within the forecast window.
 */

export interface AppointmentRow {
  id: string;
  title: string;
  isPrimary: boolean;
  solar: boolean;
  status: string;
  scheduledAtISO: string | null;
  durationMins: number;
  crew: string;
  /** appointment's calendar date in workspace tz, "yyyy-MM-dd" */
  dateKey: string | null;
}

interface SchedulingData {
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string | null;
  scheduledAt: Date;
  estimatedDurationMins: number;
}

interface OrderAppointmentsProps {
  jobId: string;
  appointments: AppointmentRow[];
  lat: number | null;
  lng: number | null;
  /** short zone name for display, e.g. "MDT" */
  tzLabel: string;
  /** temperature unit by the property's location */
  tempUnit: "F" | "C";
  primaryStaffProfileId?: string;
  primaryAssigneeName?: string;
  schedulingData?: SchedulingData;
}

/** Forecast labels → icons (the API's `icon` field is an emoji — no emojis in UI). */
function weatherIconFor(label: string): typeof Sun {
  const l = label.toLowerCase();
  if (l.includes("thunder") || l.includes("storm")) return CloudLightning;
  if (l.includes("snow") || l.includes("rime")) return CloudSnow;
  if (l.includes("rain") || l.includes("drizzle") || l.includes("shower")) return CloudRain;
  if (l.includes("fog") || l.includes("mist")) return CloudFog;
  if (l.includes("partly") || l.includes("mainly")) return CloudSun;
  if (l.includes("cloud") || l.includes("overcast")) return Cloud;
  return Sun;
}

function WeatherChip({ forecast, unit }: { forecast: { tempHighF: number; icon: string; label: string }; unit: "F" | "C" }) {
  const Icon = weatherIconFor(forecast.label);
  const temp = unit === "F" ? Math.round(forecast.tempHighF) : Math.round(((forecast.tempHighF - 32) * 5) / 9);
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[12px] font-medium text-sky-700"
      title={forecast.label}
    >
      <Icon className="h-3.5 w-3.5" />
      {temp}°{unit}
    </span>
  );
}

function ApptModal({
  jobId,
  appt,
  mode,
  onClose,
}: {
  jobId: string;
  appt: AppointmentRow;
  mode: "reschedule" | "postpone" | "cancel";
  onClose: () => void;
}) {
  const router = useRouter();
  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [dateValue, setDateValue] = useState(() => {
    if (appt.scheduledAtISO) return toLocalInput(new Date(appt.scheduledAtISO));
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalInput(d);
  });
  const [saved, setSaved] = useState(false);

  const update = trpc.jobs.updateAppointment.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 900);
    },
  });

  // Golden-hour hint while rescheduling on an order with a twilight visit
  const dateISO = dateValue?.slice(0, 10) ?? "";
  const twilight = trpc.jobs.twilightWindow.useQuery(
    { jobId, dateISO },
    { enabled: mode === "reschedule" && /^\d{4}-\d{2}-\d{2}$/.test(dateISO) }
  );
  const fmtT = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const submit = () => {
    if (mode === "reschedule") {
      const d = new Date(dateValue);
      if (isNaN(d.getTime())) return;
      update.mutate({ appointmentId: appt.id, action: "RESCHEDULE", scheduledAt: d });
    } else {
      update.mutate({ appointmentId: appt.id, action: mode === "postpone" ? "POSTPONE" : "CANCEL" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900">
              {mode === "cancel" ? "Cancel appointment" : mode === "postpone" ? "Postpone appointment" : appt.scheduledAtISO ? "Reschedule appointment" : "Schedule appointment"}
            </h2>
          </div>
          <button onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-600">×</button>
        </div>

        <div className="p-5">
          <p className="mb-3 text-[13px] font-medium text-gray-700">{appt.title}</p>
          {mode === "reschedule" ? (
            <div className="space-y-3">
              <input
                type="datetime-local"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {twilight.data?.hasSolar && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    On this date, sunset at the property is{" "}
                    <span className="font-semibold">{fmtT(twilight.data.sunset)}</span>; golden hour
                    starts <span className="font-semibold">{fmtT(twilight.data.suggestedStart)}</span>.
                  </p>
                  {(appt.solar || (appt.isPrimary && twilight.data.primaryIsSolar)) && (
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
              {dateValue && !isNaN(new Date(dateValue).getTime()) && (
                <p className="text-xs text-gray-500">{format(new Date(dateValue), "EEEE, MMMM d, yyyy 'at' h:mm a")}</p>
              )}
            </div>
          ) : mode === "postpone" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="mb-1 font-medium">Remove the scheduled time?</p>
              <p className="text-xs text-amber-700">
                The appointment stays on the order without a time — reschedule it whenever you&apos;re ready.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="mb-1 font-medium">Cancel this appointment?</p>
              <p className="text-xs text-red-700">
                It will be marked cancelled and drop out of scheduling. This doesn&apos;t delete the order.
              </p>
            </div>
          )}
          {update.error && <p className="mt-2 text-xs text-red-600">{update.error.message}</p>}
        </div>

        <div className="flex gap-3 border-t p-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={submit}
            disabled={update.isPending || saved}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60",
              saved ? "bg-green-600" :
              mode === "cancel" ? "bg-red-600 hover:bg-red-700" :
              mode === "postpone" ? "bg-amber-600 hover:bg-amber-700" :
              "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
             saved ? <><Check className="h-3.5 w-3.5" /> Done</> :
             mode === "cancel" ? "Cancel appointment" :
             mode === "postpone" ? "Confirm postpone" :
             "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderAppointments({
  jobId,
  appointments,
  lat,
  lng,
  tzLabel,
  tempUnit,
  primaryStaffProfileId,
  primaryAssigneeName,
  schedulingData,
}: OrderAppointmentsProps) {
  const [modal, setModal] = useState<{ appt: AppointmentRow; mode: "reschedule" | "postpone" | "cancel" } | null>(null);

  // One forecast fetch covers every appointment chip (7-day window)
  const forecastQuery = trpc.weather.getForecast.useQuery(
    { lat: lat ?? 0, lng: lng ?? 0 },
    { enabled: lat != null && lng != null, staleTime: 10 * 60 * 1000 }
  );
  const daily = forecastQuery.data?.daily ?? null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
          <Calendar className="h-4 w-4 text-gray-400" /> Appointments
        </h2>
        <span className="text-[11px] text-gray-400">Times in {tzLabel}</span>
      </div>

      {appointments.length === 0 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-[13px] text-amber-800">
          No appointments yet — this order has nothing to shoot on the calendar.
        </p>
      )}

      {appointments.map((a, i) => {
        const meta = APPOINTMENT_STATUS_META[a.status] ?? APPOINTMENT_STATUS_META.SCHEDULED;
        const forecast = a.dateKey && daily ? daily.find((d) => d.date === a.dateKey) : null;
        const start = a.scheduledAtISO ? new Date(a.scheduledAtISO) : null;
        return (
          <div key={a.id} className={cn("pt-4", i > 0 && "mt-4 border-t border-gray-100")}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                {a.title}
                {a.solar && (
                  <span className={cn(DIM_BADGE, "border-amber-200 bg-amber-50 text-amber-700")}>Twilight</span>
                )}
                <span className={cn(DIM_BADGE, meta.cls)}>{meta.label}</span>
              </p>
              {forecast && <WeatherChip forecast={forecast} unit={tempUnit} />}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="mb-0.5 text-xs text-gray-400">Scheduled</p>
                {start ? (
                  <>
                    <p className="font-medium text-gray-900">{format(start, "EEEE, MMM d, yyyy")}</p>
                    <p className="text-gray-600">{format(start, "h:mm a")}</p>
                  </>
                ) : (
                  <p className="italic text-amber-600">Not scheduled</p>
                )}
              </div>
              <div>
                <p className="mb-0.5 text-xs text-gray-400">Duration</p>
                <p className="text-gray-700">{a.durationMins} min estimated</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="mb-0.5 text-xs text-gray-400">Photographer</p>
                {a.isPrimary ? (
                  <JobAssignmentPicker
                    jobId={jobId}
                    currentStaffProfileId={primaryStaffProfileId}
                    currentAssigneeName={primaryAssigneeName}
                    schedulingData={schedulingData}
                  />
                ) : (
                  <p className={cn("text-gray-700", !a.crew && "italic text-amber-600")}>
                    {a.crew || "Unassigned"}
                  </p>
                )}
              </div>
            </div>

            {a.status !== "CANCELLED" && (
              <div className="mt-3 flex gap-2 border-t border-gray-50 pt-3">
                <button
                  onClick={() => setModal({ appt: a, mode: "reschedule" })}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <Pencil className="h-3 w-3" />
                  {start ? "Reschedule" : "Schedule"}
                </button>
                {start && (
                  <button
                    onClick={() => setModal({ appt: a, mode: "postpone" })}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                  >
                    <CalendarX className="h-3 w-3" />
                    Postpone
                  </button>
                )}
                <button
                  onClick={() => setModal({ appt: a, mode: "cancel" })}
                  className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                >
                  <XCircle className="h-3 w-3" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}

      {modal && (
        <ApptModal jobId={jobId} appt={modal.appt} mode={modal.mode} onClose={() => setModal(null)} />
      )}
    </section>
  );
}

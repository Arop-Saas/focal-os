"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { Clock, CheckCircle2, Loader2, Car } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Generate time options in 30-min increments
function generateTimes() {
  const times: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hour = h.toString().padStart(2, "0");
      const min = m.toString().padStart(2, "0");
      const value = `${hour}:${min}`;
      const period = h < 12 ? "AM" : "PM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayHour}:${min} ${period}`;
      times.push({ value, label });
    }
  }
  return times;
}

const TIME_OPTIONS = generateTimes();

interface DayHours {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

const BUFFER_OPTIONS = [
  { value: 0, label: "No buffer" },
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 20, label: "20 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "60 minutes" },
  { value: 90, label: "90 minutes" },
  { value: 120, label: "120 minutes" },
];

interface Props {
  initialHours: DayHours[];
  initialBufferMins?: number;
}

export function AvailabilityEditor({ initialHours, initialBufferMins = 15 }: Props) {
  const [hours, setHours] = useState<DayHours[]>(initialHours);
  const [saved, setSaved] = useState(false);
  const [bufferMins, setBufferMins] = useState(initialBufferMins);
  const [bufferSaved, setBufferSaved] = useState(false);

  const saveMutation = api.availability.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const bufferMutation = api.availability.saveBufferMins.useMutation({
    onSuccess: () => {
      setBufferSaved(true);
      setTimeout(() => setBufferSaved(false), 3000);
    },
  });

  function updateDay(dayOfWeek: number, patch: Partial<DayHours>) {
    setHours((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
    );
    setSaved(false);
  }

  function handleSave() {
    saveMutation.mutate({ hours });
  }

  return (
    <div className="max-w-2xl space-y-4">

      {/* Header card */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="h-4.5 w-4.5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Business Hours</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Toggle days and set open / close times for each day of the week.
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60 shrink-0"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : null}
            {saved ? "Saved!" : "Save Hours"}
          </button>
        </div>
      </div>

      {/* Day rows */}
      <div className="bg-white rounded-xl border divide-y overflow-hidden">
        {hours.map((day) => (
          <div
            key={day.dayOfWeek}
            className={`flex items-center gap-4 px-5 py-4 transition-colors ${
              day.isOpen ? "" : "bg-gray-50/60"
            }`}
          >
            {/* Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={day.isOpen}
              onClick={() => updateDay(day.dayOfWeek, { isOpen: !day.isOpen })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                day.isOpen ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  day.isOpen ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>

            {/* Day name */}
            <span
              className={`w-24 text-sm font-medium shrink-0 ${
                day.isOpen ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {DAY_NAMES[day.dayOfWeek]}
            </span>

            {/* Time selects */}
            {day.isOpen ? (
              <div className="flex items-center gap-2 flex-1">
                <select
                  value={day.openTime}
                  onChange={(e) => updateDay(day.dayOfWeek, { openTime: e.target.value })}
                  className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400 shrink-0">to</span>
                <select
                  value={day.closeTime}
                  onChange={(e) => updateDay(day.dayOfWeek, { closeTime: e.target.value })}
                  className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-sm text-gray-400 italic">Closed</span>
            )}
          </div>
        ))}
      </div>

      {/* Save error */}
      {saveMutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          Failed to save hours. Please try again.
        </p>
      )}

      {/* Buffer time card */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Car className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Buffer Time Between Jobs</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Travel / prep time automatically added after each job when blocking calendar slots.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <select
            value={bufferMins}
            onChange={(e) => setBufferMins(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {BUFFER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => bufferMutation.mutate({ bufferMins })}
            disabled={bufferMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60"
          >
            {bufferMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : bufferSaved ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : null}
            {bufferSaved ? "Saved!" : "Save"}
          </button>
        </div>

        {bufferMutation.isError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-3">
            Failed to save buffer time. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}

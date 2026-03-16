"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { Clock, CheckCircle2, Loader2 } from "lucide-react";

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

interface Props {
  initialHours: DayHours[];
}

export function AvailabilityEditor({ initialHours }: Props) {
  const [hours, setHours] = useState<DayHours[]>(initialHours);
  const [saved, setSaved] = useState(false);

  const saveMutation = api.availability.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
    </div>
  );
}

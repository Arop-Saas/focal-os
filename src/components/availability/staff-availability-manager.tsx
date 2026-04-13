"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Loader2, CheckCircle, User, MapPin, Globe } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DaySchedule = {
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
};

// ─── Weekly schedule editor ───────────────────────────────────────────────────

function StaffAvailabilityEditor({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [saved, setSaved] = useState(false);
  const [schedule, setSchedule] = useState<DaySchedule[] | null>(null);

  const { data, isLoading } = trpc.staff.getAvailability.useQuery({ staffId });

  useEffect(() => {
    if (data && !schedule) setSchedule(data);
  }, [data, schedule]);

  const saveMutation = trpc.staff.saveAvailability.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function toggleDay(dayOfWeek: number) {
    setSchedule((prev) =>
      prev?.map((d) => d.dayOfWeek === dayOfWeek ? { ...d, isAvailable: !d.isAvailable } : d) ?? null
    );
  }

  function updateTime(dayOfWeek: number, field: "startTime" | "endTime", value: string) {
    setSchedule((prev) =>
      prev?.map((d) => d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d) ?? null
    );
  }

  if (isLoading || !schedule) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 font-medium">{staffName}&apos;s weekly availability</p>

      {schedule.map((day) => (
        <div
          key={day.dayOfWeek}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
            day.isAvailable ? "bg-white border-gray-100" : "bg-gray-50 border-gray-100 opacity-60"
          }`}
        >
          <button
            type="button"
            onClick={() => toggleDay(day.dayOfWeek)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
              day.isAvailable ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                day.isAvailable ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`w-8 text-sm font-medium ${day.isAvailable ? "text-gray-800" : "text-gray-400"}`}>
            {DAYS[day.dayOfWeek]}
          </span>
          {day.isAvailable ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="time"
                value={day.startTime}
                onChange={(e) => updateTime(day.dayOfWeek, "startTime", e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="time"
                value={day.endTime}
                onChange={(e) => updateTime(day.dayOfWeek, "endTime", e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <span className="text-xs text-gray-400 flex-1">Unavailable</span>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle className="w-3.5 h-3.5" /> Saved
          </span>
        )}
        <button
          onClick={() => schedule && saveMutation.mutate({ staffId, availability: schedule })}
          disabled={saveMutation.isPending}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Schedule
        </button>
      </div>
    </div>
  );
}

// ─── Homebase territory picker ────────────────────────────────────────────────

interface Territory {
  id: string;
  name: string;
  color: string;
}

function HomeTerritoryPicker({
  staffId,
  territories,
}: {
  staffId: string;
  territories: Territory[];
}) {
  const { data: memberData, isLoading } = trpc.staff.getList.useQuery({});
  const updateMutation = trpc.staff.updateProfile.useMutation();
  const [saved, setSaved] = useState(false);

  // Find this staff member's current homeTerritoryId
  const staffMember = memberData?.find((m) => m.staffProfile?.id === staffId);
  const currentHomeTerritoryId = (staffMember?.staffProfile as any)?.homeTerritoryId as string | null ?? null;
  const [selected, setSelected] = useState<string | null>(undefined as unknown as null);

  // Set initial value once loaded
  useEffect(() => {
    if (selected === (undefined as unknown as null) && currentHomeTerritoryId !== undefined) {
      setSelected(currentHomeTerritoryId);
    }
  }, [currentHomeTerritoryId, selected]);

  const memberId = staffMember?.id;

  async function handleSave() {
    if (!memberId) return;
    await updateMutation.mutateAsync({ memberId, homeTerritoryId: selected });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (isLoading || selected === (undefined as unknown as null)) {
    return <div className="h-8 flex items-center"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">Home Territory</p>
        <p className="text-xs text-gray-400">Only bookings from this territory will show this photographer</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* "All territories" option */}
        <button
          type="button"
          onClick={() => setSelected(null)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
            selected === null
              ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm"
              : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          All territories
        </button>

        {territories.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
              selected === t.id
                ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm"
                : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: t.color }}
            />
            {t.name}
          </button>
        ))}

        {territories.length === 0 && (
          <p className="text-xs text-gray-400 italic">
            No territories set up yet. Create territories in the Territories tab.
          </p>
        )}
      </div>

      {selected !== null && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
          <MapPin className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            This photographer will <strong>only appear</strong> in the booking form when a client enters an address in the <strong>{territories.find(t => t.id === selected)?.name}</strong> territory. Clients outside this territory won&apos;t see them.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle className="w-3.5 h-3.5" /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Homebase
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  name: string;
  email: string;
  title?: string | null;
}

interface Props {
  staff: StaffMember[];
  territories: Territory[];
}

export function StaffAvailabilityManager({ staff, territories }: Props) {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(
    staff.length > 0 ? staff[0].id : null
  );
  const [activeSection, setActiveSection] = useState<"schedule" | "homebase">("schedule");

  if (staff.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <User className="w-8 h-8 text-gray-200 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-500">No team members yet</p>
        <p className="text-xs text-gray-400 mt-1">Add staff in Settings → Team to manage their availability.</p>
      </div>
    );
  }

  const selected = staff.find((s) => s.id === selectedStaffId);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Staff selector */}
      <div className="border-b border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Team Member</p>
        <div className="flex flex-wrap gap-2">
          {staff.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStaffId(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                s.id === selectedStaffId
                  ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs font-bold text-gray-500">
                {s.name.charAt(0).toUpperCase()}
              </div>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {selectedStaffId && selected && (
        <>
          {/* Sub-tabs */}
          <div className="border-b border-gray-100 px-4 flex gap-0">
            <button
              onClick={() => setActiveSection("schedule")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSection === "schedule"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Weekly Schedule
            </button>
            <button
              onClick={() => setActiveSection("homebase")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeSection === "homebase"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Home Territory
            </button>
          </div>

          <div className="p-4">
            {activeSection === "schedule" ? (
              <StaffAvailabilityEditor staffId={selectedStaffId} staffName={selected.name} />
            ) : (
              <HomeTerritoryPicker staffId={selectedStaffId} territories={territories} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

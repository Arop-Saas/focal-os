"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Car,
  AlertTriangle,
  Clock,
  MapPin,
  User,
  Loader2,
  LayoutGrid,
  List,
  Layers,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  addMinutes,
} from "date-fns";
import { trpc } from "@/lib/trpc/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JOB_STATUS_COLORS: Record<string, string> = {
  PENDING:      "bg-yellow-100 border-yellow-400 text-yellow-900",
  CONFIRMED:    "bg-blue-100 border-blue-400 text-blue-900",
  ASSIGNED:     "bg-indigo-100 border-indigo-400 text-indigo-900",
  IN_PROGRESS:  "bg-green-100 border-green-400 text-green-900",
  EDITING:      "bg-purple-100 border-purple-400 text-purple-900",
  REVIEW:       "bg-orange-100 border-orange-400 text-orange-900",
  DELIVERED:    "bg-teal-100 border-teal-400 text-teal-900",
  COMPLETED:    "bg-gray-100 border-gray-400 text-gray-700",
  ON_HOLD:      "bg-orange-100 border-orange-400 text-orange-900",
};

const WEEK_HOURS = Array.from({ length: 10 }, (_, i) => i + 9); // 9am–6pm

// Dispatch timeline: 7am–7pm in pixels (1 min = 2px)
const DISPATCH_START_HOUR = 7;
const DISPATCH_END_HOUR = 19;
const PX_PER_MIN = 2;
const DISPATCH_TOTAL_MINS = (DISPATCH_END_HOUR - DISPATCH_START_HOUR) * 60;
const DISPATCH_TOTAL_PX = DISPATCH_TOTAL_MINS * PX_PER_MIN;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BaseJob = {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  scheduledAt: Date;
  estimatedDurationMins: number;
  status: string;
  client: { firstName: string; lastName: string };
  assignments: Array<{
    staff: { member: { user: { fullName: string } } };
  }>;
};

type DispatchJob = {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  scheduledAt: Date;
  estimatedDurationMins: number;
  status: string;
  travelToNextMins?: number;
  travelFromPreviousMins?: number;
  hasConflict?: boolean;
  client: { firstName: string; lastName: string; phone?: string | null };
  package?: { name: string } | null;
};

type DispatchPhotographer = {
  staffId: string;
  staffName: string;
  avatarUrl?: string | null;
  jobs: DispatchJob[];
};

interface ScheduleViewProps {
  jobs: BaseJob[];
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function jobLeftPx(scheduledAt: Date): number {
  const mins = minuteOfDay(scheduledAt) - DISPATCH_START_HOUR * 60;
  return Math.max(0, mins * PX_PER_MIN);
}

function jobWidthPx(estimatedDurationMins: number): number {
  return Math.max(estimatedDurationMins * PX_PER_MIN, 24);
}

function avatarInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ViewToggle({
  view,
  setView,
}: {
  view: "week" | "dispatch" | "list";
  setView: (v: "week" | "dispatch" | "list") => void;
}) {
  const buttons: { label: string; value: "week" | "dispatch" | "list"; icon: React.ReactNode }[] = [
    { label: "Week",     value: "week",     icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { label: "Dispatch", value: "dispatch", icon: <Layers className="h-3.5 w-3.5" /> },
    { label: "List",     value: "list",     icon: <List className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="flex items-center rounded-lg border bg-white overflow-hidden">
      {buttons.map((b) => (
        <button
          key={b.value}
          onClick={() => setView(b.value)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
            view === b.value
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-50"
          )}
        >
          {b.icon}
          {b.label}
        </button>
      ))}
    </div>
  );
}

function DateNav({
  date,
  onPrev,
  onNext,
  onToday,
  label,
}: {
  date: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToday}
        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        Today
      </button>
      <button onClick={onPrev} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-semibold text-gray-900 min-w-44 text-center">{label}</span>
      <button onClick={onNext} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispatch day view components
// ---------------------------------------------------------------------------

function TravelIndicator({ mins, isConflict }: { mins: number; isConflict: boolean }) {
  return (
    <div
      className={cn(
        "absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-semibold z-10 pointer-events-none",
        isConflict
          ? "bg-red-100 text-red-700 border border-red-300"
          : "bg-gray-100 text-gray-600 border border-gray-300"
      )}
      style={{ right: -1, transform: "translateY(-50%) translateX(50%)" }}
    >
      <Car className="h-2.5 w-2.5 shrink-0" />
      {mins}m
    </div>
  );
}

function DispatchJobBlock({
  job,
  onClick,
}: {
  job: DispatchJob;
  onClick: () => void;
}) {
  const left = jobLeftPx(new Date(job.scheduledAt));
  const width = jobWidthPx(job.estimatedDurationMins);

  const statusColor = JOB_STATUS_COLORS[job.status] ?? "bg-gray-100 border-gray-300 text-gray-800";

  return (
    <div
      className="absolute top-1 bottom-1 group"
      style={{ left, width }}
    >
      {/* Job block */}
      <button
        onClick={onClick}
        className={cn(
          "h-full w-full rounded border-l-4 px-1.5 py-1 text-left transition-all hover:shadow-md hover:z-20 overflow-hidden",
          statusColor,
          job.hasConflict && "border-red-500 ring-1 ring-red-400"
        )}
      >
        {job.hasConflict && (
          <AlertTriangle className="h-2.5 w-2.5 text-red-600 absolute top-1 right-1" />
        )}
        <p className="text-[10px] font-bold leading-tight truncate">{job.jobNumber}</p>
        {width > 60 && (
          <p className="text-[10px] leading-tight truncate opacity-75">
            {format(new Date(job.scheduledAt), "h:mma")}
          </p>
        )}
        {width > 100 && (
          <p className="text-[10px] leading-tight truncate opacity-75">
            {job.client.firstName} {job.client.lastName}
          </p>
        )}
      </button>

      {/* Travel time to next job — shown as a pill to the right edge */}
      {job.travelToNextMins !== undefined && (
        <TravelIndicator
          mins={job.travelToNextMins}
          isConflict={!!job.hasConflict}
        />
      )}
    </div>
  );
}

function DispatchPhotographerRow({
  photographer,
  onJobClick,
}: {
  photographer: DispatchPhotographer;
  onJobClick: (job: DispatchJob) => void;
}) {
  const hasAnyConflict = photographer.jobs.some((j) => j.hasConflict);

  return (
    <div className="flex border-b last:border-b-0">
      {/* Staff name column */}
      <div className="w-36 shrink-0 flex items-center gap-2 p-3 border-r bg-gray-50">
        <div
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
            hasAnyConflict
              ? "bg-red-100 text-red-700"
              : "bg-blue-100 text-blue-700"
          )}
        >
          {photographer.avatarUrl ? (
            <img
              src={photographer.avatarUrl}
              alt={photographer.staffName}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            avatarInitials(photographer.staffName)
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate leading-tight">
            {photographer.staffName.split(" ")[0]}
          </p>
          <p className="text-[10px] text-gray-500 truncate">
            {photographer.jobs.length} job{photographer.jobs.length !== 1 ? "s" : ""}
          </p>
          {hasAnyConflict && (
            <div className="flex items-center gap-0.5 mt-0.5">
              <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0" />
              <span className="text-[10px] text-red-600 font-medium">Conflict</span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative flex-1 h-14" style={{ minWidth: DISPATCH_TOTAL_PX }}>
        {/* Hour grid lines */}
        {Array.from({ length: DISPATCH_END_HOUR - DISPATCH_START_HOUR + 1 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-l border-gray-100"
            style={{ left: i * 60 * PX_PER_MIN }}
          />
        ))}

        {/* Job blocks */}
        {photographer.jobs.map((job) => (
          <DispatchJobBlock
            key={job.id}
            job={job}
            onClick={() => onJobClick(job)}
          />
        ))}
      </div>
    </div>
  );
}

function DispatchTimeline() {
  return (
    <div className="flex border-b bg-gray-50 sticky top-0 z-10">
      <div className="w-36 shrink-0 border-r" />
      <div className="relative" style={{ minWidth: DISPATCH_TOTAL_PX, height: 28 }}>
        {Array.from({ length: DISPATCH_END_HOUR - DISPATCH_START_HOUR + 1 }, (_, i) => {
          const hour = DISPATCH_START_HOUR + i;
          return (
            <div
              key={hour}
              className="absolute top-0 bottom-0 border-l border-gray-200 flex items-end pb-1"
              style={{ left: i * 60 * PX_PER_MIN }}
            >
              <span className="text-[10px] font-semibold text-gray-400 pl-1">
                {hour === 12 ? "12pm" : hour > 12 ? `${hour - 12}pm` : `${hour}am`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job detail sheet
// ---------------------------------------------------------------------------

function JobDetailSheet({
  job,
  onClose,
}: {
  job: DispatchJob | BaseJob;
  onClose: () => void;
}) {
  const statusColor = JOB_STATUS_COLORS[(job as DispatchJob).status] ?? "bg-gray-100 border-gray-300 text-gray-700";
  const dispatchJob = job as DispatchJob;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-end p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {job.jobNumber}
              </span>
              <h3 className="text-base font-semibold text-gray-900 mt-0.5">
                {job.client.firstName} {job.client.lastName}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {/* Status badge */}
          <span className={cn("inline-block text-xs font-semibold px-2 py-0.5 rounded border mb-4", statusColor)}>
            {job.status.replace("_", " ")}
          </span>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-800">{job.propertyAddress}</p>
                <p className="text-xs text-gray-500">{job.propertyCity}, {job.propertyState}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm text-gray-800">
                  {format(new Date(job.scheduledAt), "h:mm a")}
                  {" · "}
                  {format(
                    addMinutes(new Date(job.scheduledAt), job.estimatedDurationMins),
                    "h:mm a"
                  )}
                </p>
                <p className="text-xs text-gray-500">{job.estimatedDurationMins} min</p>
              </div>
            </div>

            {"assignments" in job && (job as BaseJob).assignments?.length > 0 && (
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 text-gray-400 shrink-0" />
                <p className="text-sm text-gray-800">
                  {(job as BaseJob).assignments[0].staff.member.user.fullName}
                </p>
              </div>
            )}

            {/* Travel info if from dispatch view */}
            {dispatchJob.travelFromPreviousMins !== undefined && (
              <div className="flex items-center gap-2.5">
                <Car className="h-4 w-4 text-gray-400 shrink-0" />
                <p className="text-sm text-gray-800">
                  {dispatchJob.travelFromPreviousMins} min drive from previous job
                </p>
              </div>
            )}

            {dispatchJob.hasConflict && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Travel conflict</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Not enough time between consecutive jobs.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5">
            <Link
              href={`/jobs/${job.id}`}
              onClick={onClose}
              className="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Open Job
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispatch Day View
// ---------------------------------------------------------------------------

function DispatchDayView({
  date,
  onJobClick,
}: {
  date: Date;
  onJobClick: (job: DispatchJob) => void;
}) {
  const { data, isLoading, error } = trpc.scheduling.getDaySchedule.useQuery(
    { date },
    { refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-500">Loading schedule…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-red-500 text-sm">
        Failed to load schedule. Please refresh.
      </div>
    );
  }

  const photographers = data?.photographers ?? [];
  const unassigned = data?.unassigned ?? [];

  if (photographers.length === 0 && unassigned.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Calendar className="h-12 w-12 text-gray-200 mb-4" />
        <p className="text-sm font-semibold text-gray-600">No jobs scheduled</p>
        <p className="text-xs text-gray-400 mt-1">No jobs for {format(date, "MMMM d, yyyy")}</p>
      </div>
    );
  }

  const conflictCount = photographers.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, p: any) => sum + p.jobs.filter((j: any) => j.hasConflict).length,
    0
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Conflict summary banner */}
      {conflictCount > 0 && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm font-semibold text-red-700">
            {conflictCount} travel conflict{conflictCount !== 1 ? "s" : ""} detected
          </p>
          <span className="text-xs text-red-500 ml-1">— Review highlighted jobs below</span>
        </div>
      )}

      {/* Per-photographer timeline grid */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 36 * 4 + DISPATCH_TOTAL_PX + 200 }}>
            <DispatchTimeline />

            {photographers.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                All jobs are unassigned
              </div>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (photographers as any[]).map((photographer) => (
                <DispatchPhotographerRow
                  key={photographer.staffId}
                  photographer={photographer as DispatchPhotographer}
                  onJobClick={onJobClick}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Unassigned tray */}
      {unassigned.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Unassigned ({unassigned.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(unassigned as any[]).map((job) => (
              <button
                key={job.id}
                onClick={() => onJobClick(job as DispatchJob)}
                className="flex items-start gap-2 p-2.5 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{job.jobNumber}</p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {format(new Date(job.scheduledAt), "h:mm a")} · {job.estimatedDurationMins}m
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">{job.propertyCity}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week Grid View (unchanged logic, cleaned up)
// ---------------------------------------------------------------------------

function WeekGridView({
  jobs,
  weekDays,
  onJobClick,
}: {
  jobs: BaseJob[];
  weekDays: Date[];
  onJobClick: (job: BaseJob) => void;
}) {
  const jobsByDayAndHour = useMemo(() => {
    const grid: Record<string, Record<number, BaseJob[]>> = {};
    weekDays.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      grid[dayKey] = {};
      WEEK_HOURS.forEach((h) => { grid[dayKey][h] = []; });
    });
    jobs.forEach((job) => {
      const d = new Date(job.scheduledAt);
      const dayKey = format(d, "yyyy-MM-dd");
      const hour = d.getHours();
      if (grid[dayKey] && WEEK_HOURS.includes(hour)) {
        grid[dayKey][hour].push(job);
      }
    });
    return grid;
  }, [jobs, weekDays]);

  return (
    <div className="bg-white rounded-xl border overflow-auto">
      {/* Days header */}
      <div className="grid grid-cols-8 border-b sticky top-0 bg-gray-50 z-10">
        <div className="border-r p-2">
          <p className="text-xs font-semibold text-gray-400">Time</p>
        </div>
        {weekDays.map((day) => {
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={format(day, "yyyy-MM-dd")}
              className={cn("border-r p-2 text-center", isToday && "bg-blue-50")}
            >
              <p className="text-xs font-semibold text-gray-400">{format(day, "EEE")}</p>
              <p className={cn("text-sm font-semibold", isToday ? "text-blue-600" : "text-gray-900")}>
                {format(day, "d")}
              </p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-8">
        <div className="border-r bg-gray-50 divide-y">
          {WEEK_HOURS.map((hour) => (
            <div key={hour} className="h-20 p-2 text-right border-b">
              <p className="text-[10px] font-semibold text-gray-400">
                {hour % 12 || 12}{hour >= 12 ? "pm" : "am"}
              </p>
            </div>
          ))}
        </div>

        {weekDays.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={dayKey}
              className={cn("border-r divide-y", isToday && "bg-blue-50/30")}
            >
              {WEEK_HOURS.map((hour) => (
                <div key={`${dayKey}-${hour}`} className="h-20 p-1 border-b relative">
                  {(jobsByDayAndHour[dayKey]?.[hour] ?? []).map((job) => (
                    <button
                      key={job.id}
                      onClick={() => onJobClick(job)}
                      className={cn(
                        "block w-full text-left text-xs p-1 rounded border mb-1 hover:shadow transition-shadow truncate",
                        JOB_STATUS_COLORS[job.status] ?? "bg-gray-100 border-gray-300"
                      )}
                    >
                      <span className="font-semibold">{job.jobNumber}</span>
                      <span className="ml-1 opacity-70">{job.client.firstName}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------

function ListView({ jobs, onJobClick }: { jobs: BaseJob[]; onJobClick: (job: BaseJob) => void }) {
  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="h-12 w-12 text-gray-200 mb-4" />
        <p className="text-sm font-semibold text-gray-600">No scheduled jobs</p>
        <p className="text-xs text-gray-400 mt-1">No jobs scheduled for this period.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <button
          key={job.id}
          onClick={() => onJobClick(job)}
          className={cn(
            "w-full text-left p-4 rounded-xl border-l-4 bg-white hover:shadow-md transition-shadow",
            JOB_STATUS_COLORS[job.status] ?? "border-gray-300 bg-gray-50"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900">{job.jobNumber}</p>
              <p className="text-sm text-gray-600">
                {job.client.firstName} {job.client.lastName}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{job.propertyAddress}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-gray-600">
                {format(new Date(job.scheduledAt), "MMM d, h:mm a")}
              </p>
              {job.assignments[0] && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {job.assignments[0].staff.member.user.fullName}
                </p>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ScheduleView
// ---------------------------------------------------------------------------

export function ScheduleView({ jobs }: ScheduleViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"week" | "dispatch" | "list">("dispatch");
  const [selectedJob, setSelectedJob] = useState<BaseJob | DispatchJob | null>(null);

  // Week helpers
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekJobs = useMemo(
    () => jobs.filter((j) => {
      const d = new Date(j.scheduledAt);
      return d >= weekStart && d <= weekEnd;
    }),
    [jobs, weekStart, weekEnd]
  );

  function prevPeriod() {
    setCurrentDate((d) => addDays(d, view === "dispatch" ? -1 : -7));
  }
  function nextPeriod() {
    setCurrentDate((d) => addDays(d, view === "dispatch" ? 1 : 7));
  }
  function goToday() { setCurrentDate(new Date()); }

  const dateLabel =
    view === "dispatch"
      ? format(currentDate, "EEEE, MMMM d, yyyy")
      : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <ViewToggle view={view} setView={setView} />
        <DateNav
          date={currentDate}
          onPrev={prevPeriod}
          onNext={nextPeriod}
          onToday={goToday}
          label={dateLabel}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === "dispatch" && (
          <DispatchDayView
            date={currentDate}
            onJobClick={(job) => setSelectedJob(job)}
          />
        )}

        {view === "week" && (
          <WeekGridView
            jobs={weekJobs}
            weekDays={weekDays}
            onJobClick={(job) => setSelectedJob(job)}
          />
        )}

        {view === "list" && (
          <ListView
            jobs={weekJobs}
            onJobClick={(job) => setSelectedJob(job)}
          />
        )}
      </div>

      {/* Job detail sheet */}
      {selectedJob && (
        <JobDetailSheet
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}

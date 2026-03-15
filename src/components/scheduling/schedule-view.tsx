"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarDays,
  Car,
  AlertTriangle,
  Clock,
  MapPin,
  User,
  Loader2,
  LayoutGrid,
  List,
  Layers,
  Camera,
  Package,
  DollarSign,
  FileText,
  Zap,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addMonths,
  isSameDay,
  isSameMonth,
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
  propertyType?: string;
  scheduledAt: Date;
  estimatedDurationMins: number;
  status: string;
  totalAmount?: number;
  isRush?: boolean;
  internalNotes?: string | null;
  priority?: string;
  client: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string | null;
  };
  package?: { name: string } | null;
  assignments: Array<{
    staff: { member: { user: { fullName: string; avatarUrl?: string | null } } };
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
  view: "month" | "week" | "dispatch" | "list";
  setView: (v: "month" | "week" | "dispatch" | "list") => void;
}) {
  const buttons: { label: string; value: "month" | "week" | "dispatch" | "list"; icon: React.ReactNode }[] = [
    { label: "Month",    value: "month",    icon: <CalendarDays className="h-3.5 w-3.5" /> },
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
// Job side panel
// ---------------------------------------------------------------------------

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  RESIDENTIAL:      "Residential",
  COMMERCIAL:       "Commercial",
  LAND:             "Land",
  MULTI_FAMILY:     "Multi-Family",
  RENTAL:           "Rental",
  NEW_CONSTRUCTION: "New Construction",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW:    "text-gray-500 bg-gray-50 border-gray-200",
  NORMAL: "text-blue-600 bg-blue-50 border-blue-200",
  HIGH:   "text-orange-600 bg-orange-50 border-orange-200",
  URGENT: "text-red-600 bg-red-50 border-red-200",
};

function PanelRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="h-7 w-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function JobSidePanel({
  job,
  onClose,
}: {
  job: DispatchJob | BaseJob | null;
  onClose: () => void;
}) {
  const isOpen = !!job;
  const dispatchJob = job as DispatchJob | null;
  const baseJob = job as BaseJob | null;

  const statusColor = job ? (JOB_STATUS_COLORS[job.status] ?? "bg-gray-100 border-gray-300 text-gray-700") : "";
  const startTime  = job ? new Date(job.scheduledAt) : null;
  const endTime    = job && startTime ? addMinutes(startTime, job.estimatedDurationMins) : null;
  const photographer = baseJob?.assignments?.[0]?.staff?.member?.user;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/25 z-40 transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Side panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {job && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono">
                    #{job.jobNumber}
                  </span>
                  {baseJob?.isRush && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      <Zap className="h-2.5 w-2.5" /> RUSH
                    </span>
                  )}
                  {baseJob?.priority && baseJob.priority !== "NORMAL" && (
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide", PRIORITY_COLORS[baseJob.priority] ?? "")}>
                      {baseJob.priority}
                    </span>
                  )}
                </div>
                <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">
                  {job.client.firstName} {job.client.lastName}
                </h3>
                <span className={cn("inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide", statusColor)}>
                  {job.status.replace(/_/g, " ")}
                </span>
              </div>
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0 mt-0.5"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Conflict warning */}
            {dispatchJob?.hasConflict && (
              <div className="mx-5 mt-3 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Travel conflict detected</p>
                  <p className="text-[11px] text-red-500 mt-0.5">Not enough travel time between consecutive jobs.</p>
                </div>
              </div>
            )}

            {/* Details */}
            <div className="flex-1 overflow-y-auto px-5 py-2">

              {/* Property */}
              <PanelRow icon={MapPin}>
                <p className="text-[13px] font-semibold text-gray-900">{job.propertyAddress}</p>
                <p className="text-[12px] text-gray-500 mt-0.5">{job.propertyCity}, {job.propertyState}</p>
                {baseJob?.propertyType && (
                  <span className="inline-block mt-1 text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {PROPERTY_TYPE_LABELS[baseJob.propertyType] ?? baseJob.propertyType}
                  </span>
                )}
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(job.propertyAddress + " " + job.propertyCity + " " + job.propertyState)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Open in Maps →
                </a>
              </PanelRow>

              {/* Date & Time */}
              <PanelRow icon={Clock}>
                <p className="text-[13px] font-semibold text-gray-900">
                  {startTime && format(startTime, "EEEE, MMMM d, yyyy")}
                </p>
                <p className="text-[12px] text-gray-600 mt-0.5">
                  {startTime && format(startTime, "h:mm a")}
                  {endTime && <span className="text-gray-400"> → {format(endTime, "h:mm a")}</span>}
                  <span className="text-gray-400 ml-2">· {job.estimatedDurationMins} min</span>
                </p>
                {dispatchJob?.travelFromPreviousMins !== undefined && (
                  <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                    <Car className="h-3 w-3" />
                    {dispatchJob.travelFromPreviousMins} min drive from previous job
                  </p>
                )}
              </PanelRow>

              {/* Client */}
              <PanelRow icon={User}>
                <p className="text-[13px] font-semibold text-gray-900">
                  {job.client.firstName} {job.client.lastName}
                </p>
                {job.client.phone && (
                  <a href={`tel:${job.client.phone}`} className="block text-[12px] text-blue-600 hover:underline mt-0.5">
                    {job.client.phone}
                  </a>
                )}
                {(job.client as BaseJob["client"]).email && (
                  <a href={`mailto:${(job.client as BaseJob["client"]).email}`} className="block text-[12px] text-blue-600 hover:underline mt-0.5 truncate">
                    {(job.client as BaseJob["client"]).email}
                  </a>
                )}
              </PanelRow>

              {/* Photographer */}
              {photographer && (
                <PanelRow icon={Camera}>
                  <p className="text-[13px] font-semibold text-gray-900">{photographer.fullName}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Primary photographer</p>
                </PanelRow>
              )}

              {/* Package */}
              {baseJob?.package && (
                <PanelRow icon={Package}>
                  <p className="text-[13px] font-semibold text-gray-900">{baseJob.package.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Package</p>
                </PanelRow>
              )}

              {/* Financials */}
              {(baseJob?.totalAmount ?? 0) > 0 && (
                <PanelRow icon={DollarSign}>
                  <p className="text-[15px] font-bold text-gray-900">
                    ${baseJob!.totalAmount!.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Job total</p>
                </PanelRow>
              )}

              {/* Notes */}
              {baseJob?.internalNotes && (
                <PanelRow icon={FileText}>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Internal Notes</p>
                  <p className="text-[12px] text-gray-700 leading-relaxed">{baseJob.internalNotes}</p>
                </PanelRow>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-gray-100 p-4 space-y-2">
              <Link
                href={`/jobs/${job.id}`}
                onClick={onClose}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold rounded-xl transition-colors"
              >
                Open Full Job
              </Link>
              <Link
                href={`/invoices/new?jobId=${job.id}`}
                onClick={onClose}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-[13px] font-semibold rounded-xl transition-colors border border-gray-200"
              >
                Create Invoice
              </Link>
            </div>
          </>
        )}
      </div>
    </>
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
// Month Grid View
// ---------------------------------------------------------------------------

const STATUS_DOT_COLOR: Record<string, string> = {
  PENDING:      "bg-yellow-400",
  CONFIRMED:    "bg-blue-500",
  ASSIGNED:     "bg-indigo-500",
  IN_PROGRESS:  "bg-green-500",
  EDITING:      "bg-purple-500",
  REVIEW:       "bg-orange-500",
  DELIVERED:    "bg-teal-500",
  COMPLETED:    "bg-gray-400",
  ON_HOLD:      "bg-orange-400",
};

const STATUS_PILL_COLOR: Record<string, string> = {
  PENDING:      "bg-yellow-100 border-l-yellow-400 text-yellow-900",
  CONFIRMED:    "bg-blue-100 border-l-blue-500 text-blue-900",
  ASSIGNED:     "bg-indigo-100 border-l-indigo-500 text-indigo-900",
  IN_PROGRESS:  "bg-green-100 border-l-green-500 text-green-900",
  EDITING:      "bg-purple-100 border-l-purple-500 text-purple-900",
  REVIEW:       "bg-orange-100 border-l-orange-500 text-orange-900",
  DELIVERED:    "bg-teal-100 border-l-teal-500 text-teal-900",
  COMPLETED:    "bg-gray-100 border-l-gray-400 text-gray-700",
  ON_HOLD:      "bg-orange-100 border-l-orange-400 text-orange-900",
};

function MonthGridView({
  jobs,
  currentDate,
  onJobClick,
  onDayClick,
}: {
  jobs: BaseJob[];
  currentDate: Date;
  onJobClick: (job: BaseJob) => void;
  onDayClick: (date: Date) => void;
}) {
  const today = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  // Grid: from start of week of monthStart to end of week of monthEnd
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  // Build array of all days in grid
  const gridDays: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) {
    gridDays.push(d);
    d = addDays(d, 1);
  }

  // Map jobs by day key
  const jobsByDay = useMemo(() => {
    const map: Record<string, BaseJob[]> = {};
    jobs.forEach((job) => {
      const key = format(new Date(job.scheduledAt), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(job);
    });
    return map;
  }, [jobs]);

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MAX_VISIBLE = 3;

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {DAY_LABELS.map((label) => (
          <div key={label} className="py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-widest">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 divide-x divide-y border-l border-t">
        {gridDays.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayJobs = jobsByDay[dayKey] ?? [];
          const isToday = isSameDay(day, today);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const overflow = dayJobs.length > MAX_VISIBLE ? dayJobs.length - MAX_VISIBLE : 0;
          const visibleJobs = dayJobs.slice(0, MAX_VISIBLE);

          return (
            <div
              key={dayKey}
              className={cn(
                "min-h-[140px] p-2 border-b border-r",
                !isCurrentMonth && "bg-gray-50/70"
              )}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1.5">
                <button
                  onClick={() => onDayClick(day)}
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                    isToday
                      ? "bg-blue-600 text-white shadow-sm"
                      : isCurrentMonth
                      ? "text-gray-800 hover:bg-gray-100"
                      : "text-gray-300 hover:bg-gray-100"
                  )}
                >
                  {format(day, "d")}
                </button>
                {dayJobs.length > 0 && (
                  <span className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                    isCurrentMonth ? "bg-gray-100 text-gray-500" : "text-gray-300"
                  )}>
                    {dayJobs.length}
                  </span>
                )}
              </div>

              {/* Job pills */}
              <div className="space-y-1">
                {visibleJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => onJobClick(job)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded-md border-l-[3px] leading-tight hover:brightness-95 transition-all group",
                      STATUS_PILL_COLOR[job.status] ?? "bg-gray-100 border-l-gray-400 text-gray-700"
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[11px] font-bold shrink-0 tabular-nums">
                        {format(new Date(job.scheduledAt), "h:mma")}
                      </span>
                      <span className="truncate text-[11px] font-medium opacity-80">
                        {job.client.firstName} {job.client.lastName}
                      </span>
                    </div>
                    <div className="text-[10px] opacity-60 truncate mt-0.5">
                      {job.propertyAddress}
                    </div>
                  </button>
                ))}

                {overflow > 0 && (
                  <button
                    onClick={() => onDayClick(day)}
                    className="w-full text-left px-2 py-1 text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors hover:bg-blue-50 rounded-md"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ScheduleView
// ---------------------------------------------------------------------------

export function ScheduleView({ jobs }: ScheduleViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "dispatch" | "list">("dispatch");
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
    if (view === "dispatch") setCurrentDate((d) => addDays(d, -1));
    else if (view === "month") setCurrentDate((d) => addMonths(d, -1));
    else setCurrentDate((d) => addDays(d, -7));
  }
  function nextPeriod() {
    if (view === "dispatch") setCurrentDate((d) => addDays(d, 1));
    else if (view === "month") setCurrentDate((d) => addMonths(d, 1));
    else setCurrentDate((d) => addDays(d, 7));
  }
  function goToday() { setCurrentDate(new Date()); }

  const dateLabel =
    view === "dispatch"
      ? format(currentDate, "EEEE, MMMM d, yyyy")
      : view === "month"
      ? format(currentDate, "MMMM yyyy")
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
        {view === "month" && (
          <MonthGridView
            jobs={jobs}
            currentDate={currentDate}
            onJobClick={(job) => setSelectedJob(job)}
            onDayClick={(date) => {
              setCurrentDate(date);
              setView("dispatch");
            }}
          />
        )}

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

      {/* Job side panel */}
      <JobSidePanel
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </div>
  );
}

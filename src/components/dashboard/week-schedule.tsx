"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addWallDays,
  DISPLAY_TIME,
  fmtInTz,
  utcToWallParts,
  wallDateDayOfWeek,
} from "@/lib/scheduling/tz";

type Job = {
  id: string;
  propertyAddress: string;
  scheduledAt: Date | null;
  estimatedDurationMins: number;
  status: string;
  client: { firstName: string; lastName: string; phone: string | null };
  package: { name: string } | null;
  assignments: {
    staff: { member: { user: { fullName: string; avatarUrl: string | null } } };
  }[];
};

type DayHours = { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string };

interface WeekScheduleProps {
  /** Jobs scheduled within the current wall-clock week, ordered by time */
  jobs: Job[];
  timezone: string;
  /** "YYYY-MM-DD" of this week's Sunday in the workspace timezone */
  weekStartISO: string;
  /** "YYYY-MM-DD" of today in the workspace timezone */
  todayISO: string;
  /** Workspace business hours (0=Sunday … 6=Saturday) */
  hours: DayHours[];
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_PX = 40; // pixel height of one hour row
const GRID_HOURS = 24; // the grid always spans the full day; scrolling reveals off-hours

const STATUS_BLOCK: Record<string, string> = {
  PENDING: "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100",
  CONFIRMED: "border-blue-500 bg-blue-50 text-blue-900 hover:bg-blue-100",
  ASSIGNED: "border-indigo-500 bg-indigo-50 text-indigo-900 hover:bg-indigo-100",
  IN_PROGRESS: "border-violet-500 bg-violet-50 text-violet-900 hover:bg-violet-100",
  COMPLETED: "border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
  DELIVERED: "border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
};

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function hourLabel(h: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h < 12 || h === 24 ? "AM" : "PM"}`;
}

/** "Jul 26" from a wall-date ISO string (timezone-independent) */
function monthDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

type Positioned = {
  job: Job;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
};

/** Assign overlapping jobs to side-by-side lanes within a day column. */
function layoutDay(items: { job: Job; startMin: number; endMin: number }[]): Positioned[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const result: Positioned[] = [];
  let cluster: Positioned[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (cluster.length && item.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    const p: Positioned = { ...item, lane, lanes: 1 };
    cluster.push(p);
    result.push(p);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return result;
}

export function WeekSchedule({ jobs, timezone, weekStartISO, todayISO, hours }: WeekScheduleProps) {
  const hoursByDay = new Map(hours.map((h) => [h.dayOfWeek, h]));

  // Place each job on its wall-clock day in the workspace timezone
  const byDay = new Map<string, { job: Job; startMin: number; endMin: number }[]>();
  for (const job of jobs) {
    if (!job.scheduledAt) continue;
    const w = utcToWallParts(new Date(job.scheduledAt), timezone);
    const iso = `${w.year.toString().padStart(4, "0")}-${w.month.toString().padStart(2, "0")}-${w.day.toString().padStart(2, "0")}`;
    const startMin = w.hour * 60 + w.minute;
    const endMin = Math.min(startMin + Math.max(job.estimatedDurationMins || 60, 30), 24 * 60);
    (byDay.get(iso) ?? byDay.set(iso, []).get(iso)!).push({ job, startMin, endMin });
  }

  // Full-day axis; the visible window initially covers business hours ±1h
  const openDays = hours.filter((h) => h.isOpen);
  const openStartMin = openDays.length ? Math.min(...openDays.map((h) => toMin(h.openTime))) : 8 * 60;
  const openEndMin = openDays.length ? Math.max(...openDays.map((h) => toMin(h.closeTime))) : 18 * 60;

  const gridHeight = GRID_HOURS * HOUR_PX;
  const yOf = (min: number) => (min / 60) * HOUR_PX;

  const windowTop = Math.max(yOf(openStartMin) - HOUR_PX, 0);
  const windowBottom = Math.min(yOf(openEndMin) + HOUR_PX, gridHeight);
  const viewportHeight = windowBottom - windowTop;

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = windowTop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addWallDays(weekStartISO, i);
    const dow = wallDateDayOfWeek(iso);
    return {
      iso,
      dow,
      label: DOW_LABELS[dow],
      dayNum: Number(iso.split("-")[2]),
      isToday: iso === todayISO,
      hours: hoursByDay.get(dow),
      items: layoutDay(byDay.get(iso) ?? []),
    };
  });

  // "Now" marker, in the workspace timezone
  const nowParts = utcToWallParts(new Date(), timezone);
  const nowMin = nowParts.hour * 60 + nowParts.minute;

  const weekEndISO = addWallDays(weekStartISO, 6);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-50 px-5 py-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold text-gray-900">This Week</h2>
          <span className="text-[11px] text-gray-400">
            {monthDay(weekStartISO)} – {monthDay(weekEndISO)}
          </span>
        </div>
        <Link
          href="/scheduling"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          View schedule <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Day headers (fixed above the scrolling grid) */}
          <div className="flex border-b border-gray-100">
            <div className="w-12 shrink-0" />
            {days.map((day) => (
              <div key={day.iso} className="flex-1 border-l border-gray-50 py-2 text-center">
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    day.isToday ? "text-blue-600" : "text-gray-400"
                  )}
                >
                  {day.label}
                </p>
                <p
                  className={cn(
                    "mx-auto mt-0.5 grid h-6 w-6 place-items-center rounded-full text-[13px] font-bold",
                    day.isToday ? "bg-blue-600 text-white" : "text-gray-800"
                  )}
                >
                  {day.dayNum}
                </p>
              </div>
            ))}
          </div>

          {/* Scrollable full-day grid — opens on business hours ±1h */}
          <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: viewportHeight }}>
            <div className="flex">
              {/* Hour gutter */}
              <div className="relative w-12 shrink-0" style={{ height: gridHeight }}>
                {Array.from({ length: GRID_HOURS }, (_, h) => (
                  <p
                    key={h}
                    className="absolute right-2 text-[9px] font-medium text-gray-400"
                    style={{ top: h * HOUR_PX - 6 }}
                  >
                    {h > 0 && hourLabel(h)}
                  </p>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day) => {
                const open = day.hours?.isOpen
                  ? { start: toMin(day.hours.openTime), end: toMin(day.hours.closeTime) }
                  : null;
                return (
                  <div
                    key={day.iso}
                    className="relative flex-1 border-l border-gray-50 bg-gray-50/80"
                    style={{ height: gridHeight }}
                  >
                    {/* Business-hours window (white = open, gray = off-hours) */}
                    {open && (
                      <div
                        className="absolute inset-x-0 bg-white"
                        style={{ top: yOf(open.start), height: yOf(open.end) - yOf(open.start) }}
                      />
                    )}
                    {/* Hour gridlines */}
                    {Array.from({ length: GRID_HOURS }, (_, h) => (
                      <div
                        key={h}
                        className="pointer-events-none absolute inset-x-0 border-t border-gray-100/80"
                        style={{ top: h * HOUR_PX }}
                      />
                    ))}
                    {/* Today tint */}
                    {day.isToday && (
                      <div className="pointer-events-none absolute inset-0 bg-blue-500/[0.04]" />
                    )}
                    {/* Now marker */}
                    {day.isToday && (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-10 border-t border-red-400"
                        style={{ top: yOf(nowMin) }}
                      >
                        <span className="absolute -left-0.5 -top-[3px] h-1.5 w-1.5 rounded-full bg-red-400" />
                      </div>
                    )}
                    {/* Appointments */}
                    {day.items.map((p) => {
                      const top = yOf(p.startMin) + 1;
                      const height = Math.max(yOf(p.endMin) - yOf(p.startMin) - 2, 18);
                      const widthPct = 100 / p.lanes;
                      const tall = height >= 34;
                      return (
                        <Link
                          key={p.job.id}
                          href={`/jobs/${p.job.id}`}
                          className={cn(
                            "absolute z-[5] overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 transition-colors",
                            STATUS_BLOCK[p.job.status] ?? "border-gray-400 bg-gray-100 text-gray-700 hover:bg-gray-200"
                          )}
                          style={{
                            top,
                            height,
                            left: `calc(${p.lane * widthPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                          }}
                        >
                          <p className="truncate text-[9px] font-semibold leading-tight opacity-70">
                            {p.job.scheduledAt && fmtInTz(p.job.scheduledAt, timezone, DISPLAY_TIME)}
                          </p>
                          {tall && (
                            <p className="truncate text-[10px] font-semibold leading-tight">
                              {p.job.propertyAddress}
                            </p>
                          )}
                          {height >= 52 && (
                            <p className="truncate text-[9px] leading-tight opacity-60">
                              {p.job.client.firstName} {p.job.client.lastName}
                            </p>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

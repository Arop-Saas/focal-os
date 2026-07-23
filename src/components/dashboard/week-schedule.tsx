import Link from "next/link";
import { Calendar, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addWallDays,
  DISPLAY_TIME,
  fmtInTz,
  utcToWallDateISO,
  wallDateDayOfWeek,
} from "@/lib/scheduling/tz";

type Job = {
  id: string;
  propertyAddress: string;
  scheduledAt: Date | null;
  estimatedDurationMins: number;
  status: string;
  isRush?: boolean; // not in the Prisma schema yet — badge renders once it lands
  client: { firstName: string; lastName: string; phone: string | null };
  package: { name: string } | null;
  assignments: {
    staff: { member: { user: { fullName: string; avatarUrl: string | null } } };
  }[];
};

interface WeekScheduleProps {
  /** Jobs scheduled within the current wall-clock week, ordered by time */
  jobs: Job[];
  timezone: string;
  /** "YYYY-MM-DD" of this week's Sunday in the workspace timezone */
  weekStartISO: string;
  /** "YYYY-MM-DD" of today in the workspace timezone */
  todayISO: string;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-amber-400",
  CONFIRMED: "bg-blue-500",
  ASSIGNED: "bg-indigo-500",
  IN_PROGRESS: "bg-violet-500",
  COMPLETED: "bg-emerald-500",
  DELIVERED: "bg-emerald-500",
};

/** "Jul 26" from a wall-date ISO string (timezone-independent) */
function monthDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function AgendaItem({ job, timezone }: { job: Job; timezone: string }) {
  const photographer = job.assignments[0]?.staff.member.user;
  const start = job.scheduledAt ? fmtInTz(job.scheduledAt, timezone, DISPLAY_TIME) : null;
  const end =
    job.scheduledAt && job.estimatedDurationMins
      ? fmtInTz(
          new Date(new Date(job.scheduledAt).getTime() + job.estimatedDurationMins * 60_000),
          timezone,
          DISPLAY_TIME
        )
      : null;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
    >
      <div className="w-[70px] shrink-0 pt-0.5">
        <p className="text-[12px] font-semibold text-gray-700">{start ?? "—"}</p>
        {end && <p className="text-[10px] text-gray-400">– {end}</p>}
      </div>
      <div className="w-px self-stretch bg-gray-200 transition-colors group-hover:bg-blue-300" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold text-gray-900 transition-colors group-hover:text-blue-800">
            {job.propertyAddress}
          </p>
          {job.isRush && (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
              <Zap className="h-2.5 w-2.5" /> RUSH
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-gray-500">
          {job.client.firstName} {job.client.lastName}
          {photographer && <span className="text-gray-400"> · {photographer.fullName.split(" ")[0]}</span>}
          {job.package && <span className="text-gray-400"> · {job.package.name}</span>}
        </p>
      </div>
      <span
        className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[job.status] ?? "bg-gray-300")}
      />
    </Link>
  );
}

export function WeekSchedule({ jobs, timezone, weekStartISO, todayISO }: WeekScheduleProps) {
  // Group jobs onto wall-clock days in the workspace timezone
  const byDay = new Map<string, Job[]>();
  for (const job of jobs) {
    if (!job.scheduledAt) continue;
    const iso = utcToWallDateISO(new Date(job.scheduledAt), timezone);
    (byDay.get(iso) ?? byDay.set(iso, []).get(iso)!).push(job);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addWallDays(weekStartISO, i);
    return {
      iso,
      dow: DOW_LABELS[wallDateDayOfWeek(iso)],
      dayNum: Number(iso.split("-")[2]),
      isToday: iso === todayISO,
      jobs: byDay.get(iso) ?? [],
    };
  });

  const weekEndISO = addWallDays(weekStartISO, 6);
  const total = jobs.length;

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

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
            <Calendar className="h-5 w-5 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-700">Nothing scheduled this week</p>
          <p className="mb-4 mt-1 text-xs text-gray-400">Your week is wide open</p>
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
          >
            Book a shoot <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {days.map((day) => (
            <div key={day.iso} className={cn("flex gap-4 px-5 py-3", day.isToday && "bg-blue-50/30")}>
              <div className="w-10 shrink-0 pt-0.5 text-center">
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    day.isToday ? "text-blue-600" : "text-gray-400"
                  )}
                >
                  {day.dow}
                </p>
                <p
                  className={cn(
                    "mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-[14px] font-bold",
                    day.isToday ? "bg-blue-600 text-white" : "text-gray-800"
                  )}
                >
                  {day.dayNum}
                </p>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {day.jobs.length === 0 ? (
                  <p className="pt-2.5 text-[12px] text-gray-300">No shoots</p>
                ) : (
                  day.jobs.map((job) => <AgendaItem key={job.id} job={job} timezone={timezone} />)
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

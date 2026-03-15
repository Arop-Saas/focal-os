import Link from "next/link";
import { Calendar, Clock, User, ArrowRight, ChevronRight, Zap } from "lucide-react";
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS, cn } from "@/lib/utils";

type Job = {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  scheduledAt: Date | null;
  estimatedDurationMins: number;
  status: string;
  isRush: boolean;
  client: { firstName: string; lastName: string; phone: string | null };
  package: { name: string } | null;
  assignments: {
    staff: { member: { user: { fullName: string; avatarUrl: string | null } } };
  }[];
};

function JobRow({ job, highlight = false }: { job: Job; highlight?: boolean }) {
  const photographer = job.assignments[0]?.staff.member.user;
  const date = job.scheduledAt ? new Date(job.scheduledAt) : null;
  const endTime = date && job.estimatedDurationMins
    ? new Date(date.getTime() + job.estimatedDurationMins * 60 * 1000)
    : null;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={cn(
        "flex items-center gap-4 px-5 py-3.5 transition-colors group",
        highlight ? "hover:bg-blue-50/60" : "hover:bg-gray-50/80"
      )}
    >
      <div className={cn(
        "flex flex-col items-center justify-center min-w-[40px] h-11 rounded-lg shrink-0 transition-colors",
        highlight ? "bg-blue-50 group-hover:bg-blue-100" : "bg-gray-50 group-hover:bg-blue-50"
      )}>
        <span className={cn(
          "text-[9px] font-bold uppercase tracking-wide transition-colors",
          highlight ? "text-blue-500" : "text-gray-400 group-hover:text-blue-400"
        )}>
          {date ? date.toLocaleDateString("en-US", { month: "short" }) : "—"}
        </span>
        <span className={cn(
          "text-[18px] font-bold leading-none transition-colors",
          highlight ? "text-blue-700" : "text-gray-800 group-hover:text-blue-700"
        )}>
          {date ? date.getDate() : "—"}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-gray-900 truncate flex-1 group-hover:text-blue-800 transition-colors">
            {job.propertyAddress}
          </p>
          {job.isRush && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
              <Zap className="h-2.5 w-2.5" /> RUSH
            </span>
          )}
          <span className={cn(
            "shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border",
            JOB_STATUS_COLORS[job.status]
          )}>
            {JOB_STATUS_LABELS[job.status]}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[11px] text-gray-500 flex items-center gap-1 shrink-0">
            <User className="h-3 w-3" />
            {job.client.firstName} {job.client.lastName}
          </span>
          {date && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
              <Clock className="h-3 w-3" />
              {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              {endTime && (
                <span className="text-gray-300">
                  {" – "}{endTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </span>
          )}
          {photographer && (
            <span className="text-[11px] text-gray-400 shrink-0">
              📷 {photographer.fullName.split(" ")[0]}
            </span>
          )}
          {job.package && (
            <span className="text-[11px] text-gray-300 shrink-0 truncate">{job.package.name}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

interface UpcomingJobsProps {
  todaysJobs: Job[];
  upcomingJobs: Job[];
}

export function UpcomingJobs({ todaysJobs, upcomingJobs }: UpcomingJobsProps) {
  const hasAnything = todaysJobs.length > 0 || upcomingJobs.length > 0;

  if (!hasAnything) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="text-[13px] font-semibold text-gray-900">Schedule</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-14 text-center px-6">
          <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center mb-3">
            <Calendar className="h-5 w-5 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-700">Nothing scheduled</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Your week is wide open</p>
          <Link href="/jobs/new" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            Book a shoot <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <h2 className="text-[13px] font-semibold text-gray-900">Schedule</h2>
        <Link href="/jobs" className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors">
          All jobs <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {todaysJobs.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-5 py-2 bg-blue-50/60 border-b border-blue-100/50">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-[10px] font-bold tracking-widest uppercase text-blue-600">
              Today · {todaysJobs.length} shoot{todaysJobs.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {todaysJobs.map((job) => <JobRow key={job.id} job={job} highlight />)}
          </div>
        </>
      )}

      {upcomingJobs.length > 0 && (
        <>
          <div className="px-5 py-2 bg-gray-50/50 border-y border-gray-100/60">
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">This Week</p>
          </div>
          <div className="divide-y divide-gray-50">
            {upcomingJobs.map((job) => <JobRow key={job.id} job={job} />)}
          </div>
        </>
      )}
    </div>
  );
}

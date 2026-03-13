import Link from "next/link";
import { Calendar, Clock, ChevronRight, User, ArrowRight } from "lucide-react";
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";

type UpcomingJob = {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  scheduledAt: Date | null;
  estimatedDurationMins: number;
  status: string;
  client: { firstName: string; lastName: string; phone: string | null };
  package: { name: string } | null;
  assignments: {
    staff: {
      member: {
        user: { fullName: string; avatarUrl: string | null };
      };
    };
  }[];
};

interface UpcomingJobsProps {
  jobs: UpcomingJob[];
}

export function UpcomingJobs({ jobs }: UpcomingJobsProps) {
  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-[13px] font-semibold text-gray-900">Upcoming Jobs</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
          <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center mb-3">
            <Calendar className="h-5 w-5 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-700">No upcoming jobs</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Schedule your next shoot to get started</p>
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Create a job <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <h2 className="text-[13px] font-semibold text-gray-900">Upcoming Jobs</h2>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-gray-50">
        {jobs.map((job) => {
          const photographer = job.assignments[0]?.staff.member.user;
          const date = job.scheduledAt ? new Date(job.scheduledAt) : null;
          return (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group"
            >
              {/* Date pill */}
              <div className="flex flex-col items-center justify-center min-w-[38px] h-10 rounded-lg bg-gray-50 group-hover:bg-blue-50 transition-colors">
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide group-hover:text-blue-400 transition-colors">
                  {date ? date.toLocaleDateString("en-US", { month: "short" }) : "—"}
                </span>
                <span className="text-[17px] font-bold text-gray-800 leading-none group-hover:text-blue-700 transition-colors">
                  {date ? date.getDate() : "—"}
                </span>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-gray-900 truncate flex-1">
                    {job.propertyAddress}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border",
                      JOB_STATUS_COLORS[job.status]
                    )}
                  >
                    {JOB_STATUS_LABELS[job.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-gray-400 truncate">
                    {job.client.firstName} {job.client.lastName}
                    {job.package && <span className="text-gray-300"> · {job.package.name}</span>}
                  </span>
                  {date && (
                    <span class"name="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
                      <Clock className="h-3 w-3" />
                      {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                   {photographer && (
                    <span className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
                      <User className="h-3 w-3" />
                      {photographer.fullName.split(" ")[0]}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

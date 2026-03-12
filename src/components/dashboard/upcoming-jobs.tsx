import Link from "next/link";
import { Calendar, MapPin, Clock, ChevronRight, User } from "lucide-react";
import { formatDateTime, JOB_STATUS_COLORS, JOB_STATUS_LABELS } from "@/lib/utils";
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
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Upcoming Jobs</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Calendar className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No upcoming jobs</p>
          <p className="text-xs text-gray-400 mt-1">Schedule your next shoot to get started</p>
          <Link
            href="/jobs/new"
            className="mt-4 text-xs font-medium text-blue-600 hover:underline"
          >
            + Create a job
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="text-base font-semibold text-gray-900">Upcoming Jobs</h2>
        <Link href="/jobs" className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1">
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y">
        {jobs.map((job) => {
          const photographer = job.assignments[0]?.staff.member.user;
          return (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              {/* Date column */}
              <div className="flex flex-col items-center min-w-[40px]">
                <span className="text-xs font-medium text-gray-400 uppercase">
                  {job.scheduledAt
                    ? new Date(job.scheduledAt).toLocaleDateString("en-US", { month: "short" })
                    : "TBD"}
                </span>
                <span className="text-xl font-bold text-gray-900 leading-tight">
                  {job.scheduledAt ? new Date(job.scheduledAt).getDate() : "—"}
                </span>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {job.propertyAddress}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {job.client.firstName} {job.client.lastName}
                      {job.package && ` · ${job.package.name}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border",
                      JOB_STATUS_COLORS[job.status]
                    )}
                  >
                    {JOB_STATUS_LABELS[job.status]}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                  {job.scheduledAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(job.scheduledAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {job.estimatedDurationMins}m
                    </span>
                  )}
                  {photographer && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {photographer.fullName}
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

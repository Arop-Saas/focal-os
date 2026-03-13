import Link from "next/link";
import { formatRelative, JOB_STATUS_COLORS, JOB_STATUS_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Activity, ChevronRight } from "lucide-react";

type Job = {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  status: string;
  updatedAt: Date;
  client: { firstName: string; lastName: string };
};

export function RecentActivity({ jobs }: { jobs: Job[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 shrink-0">
        <h2 className="text-[13px] font-semibold text-gray-900">Recent Activity</h2>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          All jobs <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-10 text-center px-4">
          <div className="h-9 w-9 rounded-full bg-gray-50 flex items-center justify-center mb-2">
            <Activity className="h-4 w-4 text-gray-300" />
          </div>
          <p className="text-xs text-gray-400">No recent activity</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 flex-1">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/80 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                  {job.propertyAddress}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                  {job.client.firstName} {job.client.lastName}
                  <span className="text-gray-300"> · #{job.jobNumber}</span>
                </p>
                <p className="text-[10px] text-gray-300 mt-0.5">{formatRelative(job.updatedAt)}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border mt-0.5",
                  JOB_STATUS_COLORS[job.status]
                )}
              >
                {JOB_STATUS_LABELS[job.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

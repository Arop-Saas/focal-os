import Link from "next/link";
import { formatRelative, JOB_STATUS_COLORS, JOB_STATUS_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

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
    <div className="bg-white rounded-xl border h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
        <Link href="/jobs" className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1">
          All jobs <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-muted-foreground">No recent activity</p>
        </div>
      ) : (
        <div className="divide-y">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {job.propertyAddress}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {job.client.firstName} {job.client.lastName} · #{job.jobNumber}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">{formatRelative(job.updatedAt)}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border mt-0.5",
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

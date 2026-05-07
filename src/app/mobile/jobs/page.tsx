"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import BottomNav from "../_components/BottomNav";
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";

type Job = {
  id: string;
  propertyAddress: string;
  scheduledAt: Date | string | null;
  status: string;
  actualStartAt: Date | string | null;
  client: { firstName: string; lastName: string } | null;
  package: { name: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:     { label: "Pending",     color: "bg-gray-700 text-gray-300" },
  CONFIRMED:   { label: "Confirmed",   color: "bg-blue-900/60 text-blue-300" },
  ASSIGNED:    { label: "Assigned",    color: "bg-indigo-900/60 text-indigo-300" },
  IN_PROGRESS: { label: "In Progress", color: "bg-green-900/60 text-green-300" },
  EDITING:     { label: "Editing",     color: "bg-yellow-900/60 text-yellow-300" },
};

function groupJobs(jobs: Job[]): { label: string; jobs: Job[] }[] {
  const today: Job[] = [];
  const tomorrow: Job[] = [];
  const thisWeek: Job[] = [];
  const later: Job[] = [];

  for (const job of jobs) {
    if (!job.scheduledAt) { later.push(job); continue; }
    const d = new Date(job.scheduledAt);
    if (isToday(d)) today.push(job);
    else if (isTomorrow(d)) tomorrow.push(job);
    else if (isThisWeek(d)) thisWeek.push(job);
    else later.push(job);
  }

  const groups = [];
  if (today.length)    groups.push({ label: "Today",     jobs: today });
  if (tomorrow.length) groups.push({ label: "Tomorrow",  jobs: tomorrow });
  if (thisWeek.length) groups.push({ label: "This Week", jobs: thisWeek });
  if (later.length)    groups.push({ label: "Upcoming",  jobs: later });
  return groups;
}

export default function MobileJobsPage() {
  const router = useRouter();
  const { data: jobs, isLoading, error, refetch } = trpc.mobile.getMyJobs.useQuery(undefined, {
    retry: false,
  });

  // Redirect to login if forbidden (no staff profile / not authed)
  if (error?.data?.code === "FORBIDDEN" || error?.data?.code === "UNAUTHORIZED") {
    router.replace("/mobile/login");
    return null;
  }

  const groups = jobs ? groupJobs(jobs as Job[]) : [];

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 pt-safe-top">
        <div className="flex items-center justify-between py-4">
          <div>
            <h1 className="text-xl font-bold text-white">My Jobs</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {format(new Date(), "EEEE, MMMM d")}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 active:bg-gray-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Loading your jobs…</p>
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">No upcoming jobs</p>
            <p className="text-gray-600 text-sm mt-1">You&apos;re all caught up!</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {group.label}
            </h2>
            <div className="space-y-3">
              {group.jobs.map((job) => {
                const status = STATUS_CONFIG[job.status] ?? { label: job.status, color: "bg-gray-700 text-gray-300" };
                const time = job.scheduledAt
                  ? format(new Date(job.scheduledAt), "h:mm a")
                  : "Time TBD";
                const isClockedIn = !!job.actualStartAt;

                return (
                  <button
                    key={job.id}
                    onClick={() => router.push(`/mobile/jobs/${job.id}`)}
                    className="w-full text-left bg-gray-900 rounded-2xl p-4 border border-gray-800 active:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm leading-snug truncate">
                          {job.propertyAddress}
                        </p>
                        {job.client && (
                          <p className="text-gray-500 text-xs mt-0.5">
                            {job.client.firstName} {job.client.lastName}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      {/* Time */}
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                        </svg>
                        <span className="text-xs">{time}</span>
                      </div>

                      {/* Package */}
                      {job.package && (
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
                          </svg>
                          <span className="text-xs truncate max-w-[100px]">{job.package.name}</span>
                        </div>
                      )}

                      {/* Clocked in indicator */}
                      {isClockedIn && (
                        <div className="ml-auto flex items-center gap-1 text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-[10px] font-medium">Live</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

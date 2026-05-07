"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { ChevronDown, Loader2 } from "lucide-react";
import { JOB_STATUS_LABELS, cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  "PENDING",
  "CONFIRMED",
  "ASSIGNED",
  "IN_PROGRESS",
  "EDITING",
  "REVIEW",
  "DELIVERED",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const;

type JobStatus = (typeof STATUS_OPTIONS)[number];

interface JobStatusUpdaterProps {
  jobId: string;
  currentStatus: string;
}

export function JobStatusUpdater({ jobId, currentStatus }: JobStatusUpdaterProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const updateJob = trpc.jobs.update.useMutation({
    onSuccess: () => {
      router.refresh();
      setOpen(false);
    },
  });

  function handleSelect(status: JobStatus) {
    if (status === currentStatus) {
      setOpen(false);
      return;
    }
    updateJob.mutate({ id: jobId, status });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={updateJob.isPending}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
      >
        {updateJob.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
        ) : null}
        Update status
        <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1.5 z-20 bg-white rounded-xl border border-gray-200 shadow-lg py-1.5 min-w-[180px]">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                onClick={() => handleSelect(status)}
                disabled={updateJob.isPending}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors",
                  status === currentStatus && "opacity-40 cursor-default"
                )}
              >
                <span className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  status === "PENDING" && "bg-yellow-400",
                  status === "CONFIRMED" && "bg-blue-500",
                  status === "ASSIGNED" && "bg-indigo-500",
                  status === "IN_PROGRESS" && "bg-purple-500",
                  status === "EDITING" && "bg-orange-500",
                  status === "REVIEW" && "bg-pink-500",
                  status === "DELIVERED" && "bg-teal-500",
                  status === "COMPLETED" && "bg-green-500",
                  status === "ON_HOLD" && "bg-gray-400",
                  status === "CANCELLED" && "bg-red-400",
                )} />
                {JOB_STATUS_LABELS[status] ?? status}
                {status === currentStatus && (
                  <span className="ml-auto text-xs text-gray-400">current</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

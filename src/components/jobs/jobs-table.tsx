"use client";

import Link from "next/link";
import { cn, formatDateTime, formatCurrency, JOB_STATUS_COLORS, JOB_STATUS_LABELS } from "@/lib/utils";
import { MapPin, Calendar, User, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

type Job = {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  scheduledAt: Date | null;
  status: string;
  totalAmount: number;
  isRush: boolean;
  client: { id: string; firstName: string; lastName: string; email: string };
  package: { name: string } | null;
  assignments: {
    staff: { member: { user: { fullName: string } } };
  }[];
  invoice: { status: string; totalAmount: number } | null;
};

interface JobsTableProps {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
}

export function JobsTable({ jobs, total, page, limit }: JobsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / limit);

  function changePage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`?${params.toString()}`);
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-base font-semibold text-gray-700">No jobs found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try changing your filters or create a new job.
        </p>
        <Link
          href="/jobs/new"
          className="mt-4 text-sm font-medium text-blue-600 hover:underline"
        >
          + Create your first job
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Job</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Client</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Scheduled</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Photographer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.map((job) => {
              const photographer = job.assignments[0]?.staff.member.user.fullName;
              return (
                <tr
                  key={job.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/jobs/${job.id}`)}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-start gap-2">
                      {job.isRush && (
                        <span className="shrink-0 mt-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                          RUSH
                        </span>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{job.propertyAddress}</p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" />
                          {job.propertyCity}, {job.propertyState}
                          <span className="text-gray-300 mx-1">·</span>
                          #{job.jobNumber}
                        </p>
                        {job.package && (
                          <p className="text-xs text-blue-600 mt-0.5">{job.package.name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-gray-800">
                      {job.client.firstName} {job.client.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{job.client.email}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    {job.scheduledAt ? (
                      <div>
                        <p className="font-medium text-gray-800">
                          {new Date(job.scheduledAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(job.scheduledAt).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">Unscheduled</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {photographer ? (
                      <span className="text-gray-700">{photographer}</span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border",
                        JOB_STATUS_COLORS[job.status]
                      )}
                    >
                      {JOB_STATUS_LABELS[job.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <p className="font-medium text-gray-900">
                      {formatCurrency(job.totalAmount)}
                    </p>
                    {job.invoice && (
                      <p className={cn(
                        "text-[10px] uppercase font-semibold mt-0.5",
                        job.invoice.status === "PAID" ? "text-green-600" :
                        job.invoice.status === "OVERDUE" ? "text-red-600" : "text-gray-400"
                      )}>
                        {job.invoice.status}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page === 1}
              className="flex items-center justify-center h-7 w-7 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs font-medium text-gray-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => changePage(page + 1)}
              disabled={page === totalPages}
              className="flex items-center justify-center h-7 w-7 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

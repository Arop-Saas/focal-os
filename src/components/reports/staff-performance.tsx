"use client";

import { Camera, CheckCircle, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface StaffStat {
  staffId: string;
  name: string;
  avatarInitials: string;
  totalJobs: number;
  completedJobs: number;
  revenue: number;
  completionRate: number;
}

interface StaffPerformanceProps {
  data: StaffStat[];
}

export function StaffPerformance({ data }: StaffPerformanceProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No staff job data yet. Assign staff to jobs to see performance metrics.
      </p>
    );
  }

  const maxRevenue = Math.max(...data.map((s) => s.revenue), 1);

  return (
    <div className="space-y-3">
      {data.map((staff) => (
        <div
          key={staff.staffId}
          className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          {/* Avatar */}
          <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
            {staff.avatarInitials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{staff.name}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <Camera className="h-3 w-3" />
                {staff.totalJobs} jobs
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {staff.completionRate}% complete
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <DollarSign className="h-3 w-3 text-teal-500" />
                {formatCurrency(staff.revenue)}
              </span>
            </div>
            {/* Revenue bar */}
            <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${(staff.revenue / maxRevenue) * 100}%` }}
              />
            </div>
          </div>

          {/* Revenue badge */}
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-gray-900">{formatCurrency(staff.revenue)}</p>
            <p className="text-[10px] text-gray-400">revenue</p>
          </div>
        </div>
      ))}
    </div>
  );
}

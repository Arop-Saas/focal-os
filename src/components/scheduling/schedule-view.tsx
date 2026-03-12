"use client";

import { useState, useMemo } from "react";
import { cn, formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays, startOfDay, endOfDay, isSameDay } from "date-fns";

const JOB_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 border-yellow-300 text-yellow-900",
  CONFIRMED: "bg-blue-100 border-blue-300 text-blue-900",
  ASSIGNED: "bg-blue-100 border-blue-300 text-blue-900",
  IN_PROGRESS: "bg-green-100 border-green-300 text-green-900",
  COMPLETED: "bg-gray-100 border-gray-300 text-gray-900",
  ON_HOLD: "bg-orange-100 border-orange-300 text-orange-900",
};

const HOURS = Array.from({ length: 10 }, (_, i) => i + 9); // 9am - 6pm

type Job = {
  id: string;
  jobNumber: string;
  propertyAddress: string;
  scheduledAt: Date;
  estimatedDurationMins: number;
  status: string;
  client: {
    firstName: string;
    lastName: string;
  };
  assignments: Array<{
    staff: {
      member: {
        user: {
          fullName: string;
        };
      };
    };
  }>;
};

interface ScheduleViewProps {
  jobs: Job[];
}

export function ScheduleView({ jobs }: ScheduleViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"week" | "day" | "list">("week");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Calculate week dates
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get jobs for current week
  const weekJobs = useMemo(() => {
    return jobs.filter(job => {
      const jobDate = new Date(job.scheduledAt);
      return jobDate >= weekStart && jobDate <= weekEnd;
    });
  }, [jobs, weekStart, weekEnd]);

  // Group jobs by day and hour
  const jobsByDayAndHour = useMemo(() => {
    const grid: Record<string, Record<number, Job[]>> = {};

    weekDays.forEach(day => {
      const dayKey = format(day, "yyyy-MM-dd");
      grid[dayKey] = {};
      HOURS.forEach(hour => {
        grid[dayKey][hour] = [];
      });
    });

    weekJobs.forEach(job => {
      const jobDate = new Date(job.scheduledAt);
      const dayKey = format(jobDate, "yyyy-MM-dd");
      const hour = jobDate.getHours();

      if (grid[dayKey] && HOURS.includes(hour)) {
        grid[dayKey][hour].push(job);
      }
    });

    return grid;
  }, [weekDays, weekJobs]);

  function goToPreviousWeek() {
    setCurrentDate(addDays(currentDate, -7));
  }

  function goToNextWeek() {
    setCurrentDate(addDays(currentDate, 7));
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  // List view
  if (view === "list") {
    return (
      <div className="flex flex-col h-full">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("week")}
              className={cn(
                "px-3 py-2 rounded text-sm font-medium border transition-colors",
                view === "week"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}
            >
              Week
            </button>
            <button
              onClick={() => setView("day")}
              className={cn(
                "px-3 py-2 rounded text-sm font-medium border transition-colors",
                view === "day"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}
            >
              Day
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "px-3 py-2 rounded text-sm font-medium border transition-colors",
                view === "list"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}
            >
              List
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-2 rounded text-sm font-medium bg-white text-gray-600 border border-gray-200 hover:border-gray-300 transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-gray-900 min-w-48 text-center">
              {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
            </span>
            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto">
          {weekJobs.length === 0 ? (
            <div className="bg-white rounded-lg border flex flex-col items-center justify-center py-16 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-base font-semibold text-gray-700">No scheduled jobs</p>
              <p className="text-sm text-muted-foreground mt-1">
                No jobs scheduled for this period.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {weekJobs.map(job => (
                <div
                  key={job.id}
                  className={cn(
                    "p-4 rounded-lg border-l-4 bg-white hover:shadow-md transition-shadow cursor-pointer",
                    JOB_STATUS_COLORS[job.status] || "bg-gray-50"
                  )}
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{job.jobNumber}</p>
                      <p className="text-sm text-gray-600">{job.client.firstName} {job.client.lastName}</p>
                      <p className="text-sm text-gray-500 mt-1">{job.propertyAddress}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-600">
                        {format(new Date(job.scheduledAt), "MMM d, h:mm a")}
                      </p>
                      {job.assignments.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {job.assignments[0].staff.member.user.fullName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Week view
  return (
    <div className="flex flex-col h-full">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("week")}
            className={cn(
              "px-3 py-2 rounded text-sm font-medium border transition-colors",
              view === "week"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            )}
          >
            Week
          </button>
          <button
            onClick={() => setView("day")}
            className={cn(
              "px-3 py-2 rounded text-sm font-medium border transition-colors",
              view === "day"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            )}
          >
            Day
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "px-3 py-2 rounded text-sm font-medium border transition-colors",
              view === "list"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            )}
          >
            List
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-2 rounded text-sm font-medium bg-white text-gray-600 border border-gray-200 hover:border-gray-300 transition-colors"
          >
            Today
          </button>
          <button
            onClick={goToPreviousWeek}
            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-900 min-w-48 text-center">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </span>
          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto bg-white rounded-lg border">
        {/* Days Header */}
        <div className="grid grid-cols-8 gap-0 border-b sticky top-0 bg-gray-50 z-10">
          <div className="border-r p-2 min-w-12">
            <p className="text-xs font-semibold text-gray-500">Time</p>
          </div>
          {weekDays.map(day => {
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={format(day, "yyyy-MM-dd")}
                className={cn(
                  "border-r p-2 text-center",
                  isToday && "bg-blue-50"
                )}
              >
                <p className="text-xs font-semibold text-gray-500">
                  {format(day, "EEE")}
                </p>
                <p className={cn(
                  "text-sm font-semibold",
                  isToday ? "text-blue-600" : "text-gray-900"
                )}>
                  {format(day, "d")}
                </p>
              </div>
            );
          })}
        </div>

        {/* Time Grid */}
        <div className="grid grid-cols-8 gap-0">
          {/* Time Column */}
          <div className="border-r divide-y bg-gray-50">
            {HOURS.map(hour => (
              <div key={hour} className="h-20 p-2 text-right border-b">
                <p className="text-xs font-semibold text-gray-500">
                  {hour % 12 || 12}{hour >= 12 ? "pm" : "am"}
                </p>
              </div>
            ))}
          </div>

          {/* Days Grid */}
          {weekDays.map(day => {
            const dayKey = format(day, "yyyy-MM-dd");
            const isToday = isSameDay(day, new Date());

            return (
              <div key={dayKey} className={cn(
                "border-r divide-y",
                isToday && "bg-blue-50 bg-opacity-30"
              )}>
                {HOURS.map(hour => {
                  const dayJobs = jobsByDayAndHour[dayKey]?.[hour] || [];

                  return (
                    <div
                      key={`${dayKey}-${hour}`}
                      className="h-20 p-1 border-b relative"
                    >
                      {dayJobs.map((job, idx) => (
                        <div
                          key={job.id}
                          onClick={() => setSelectedJob(job)}
                          className={cn(
                            "text-xs p-1 rounded cursor-pointer border mb-1 hover:shadow-md transition-shadow",
                            JOB_STATUS_COLORS[job.status] || "bg-gray-100"
                          )}
                        >
                          <p className="font-semibold truncate">{job.jobNumber}</p>
                          <p className="text-[10px] truncate">{job.client.firstName}</p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Job Detail Popover */}
      {selectedJob && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:justify-end p-4 z-50"
          onClick={() => setSelectedJob(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {selectedJob.jobNumber}
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">
                    {selectedJob.client.firstName} {selectedJob.client.lastName}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Address</p>
                  <p className="text-sm text-gray-700 mt-1">{selectedJob.propertyAddress}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Scheduled</p>
                  <p className="text-sm text-gray-700 mt-1">
                    {format(new Date(selectedJob.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Duration</p>
                  <p className="text-sm text-gray-700 mt-1">{selectedJob.estimatedDurationMins} minutes</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Status</p>
                  <p className={cn(
                    "text-sm font-medium mt-1 inline-block px-2 py-1 rounded",
                    JOB_STATUS_COLORS[selectedJob.status] || "bg-gray-100 text-gray-800"
                  )}>
                    {selectedJob.status}
                  </p>
                </div>

                {selectedJob.assignments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">Assigned Staff</p>
                    <p className="text-sm text-gray-700 mt-1">
                      {selectedJob.assignments[0].staff.member.user.fullName}
                    </p>
                  </div>
                )}
              </div>

              <button
                className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";

type StatusCount = { status: string; _count: { status: number } };

const PIPELINE_STAGES = [
  { status: "PENDING",     label: "Pending",     color: "bg-yellow-400", text: "text-yellow-700", bg: "bg-yellow-50",  border: "border-yellow-200" },
  { status: "CONFIRMED",   label: "Confirmed",   color: "bg-blue-400",   text: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200"   },
  { status: "ASSIGNED",    label: "Assigned",    color: "bg-indigo-400", text: "text-indigo-700", bg: "bg-indigo-50",  border: "border-indigo-200" },
  { status: "IN_PROGRESS", label: "Shooting",    color: "bg-purple-400", text: "text-purple-700", bg: "bg-purple-50",  border: "border-purple-200" },
  { status: "EDITING",     label: "Editing",     color: "bg-violet-400", text: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200" },
  { status: "REVIEW",      label: "Review",      color: "bg-orange-400", text: "text-orange-700", bg: "bg-orange-50",  border: "border-orange-200" },
  { status: "ON_HOLD",     label: "On Hold",     color: "bg-gray-400",   text: "text-gray-600",   bg: "bg-gray-50",    border: "border-gray-200"   },
];

export function JobPipeline({ statusCounts }: { statusCounts: StatusCount[] }) {
  const countMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.status])
  );
  const totalActive = statusCounts.reduce((sum, s) => sum + s._count.status, 0);

  if (totalActive === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          Active Pipeline · {totalActive} job{totalActive !== 1 ? "s" : ""}
        </p>
        <Link href="/jobs" className="text-[11px] text-blue-600 hover:text-blue-700 transition-colors font-medium">
          Manage
        </Link>
      </div>
      <div className="flex gap-2 flex-wrap">
        {PIPELINE_STAGES.map(({ status, label, color, text, bg, border }) => {
          const count = countMap[status] ?? 0;
          if (count === 0) return null;
          return (
            <Link
              key={status}
              href={`/jobs?status=${status}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${bg} ${border} hover:opacity-80 transition-opacity`}
            >
              <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
              <span className={`text-[12px] font-semibold ${text}`}>{count}</span>
              <span className={`text-[11px] ${text} opacity-70`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Download, ChevronDown, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

const PAY_TYPE_LABELS: Record<string, string> = {
  PER_JOB: "Per Job",
  HOURLY: "Hourly",
  COMMISSION: "Commission",
  SALARY: "Salary",
};

const PAY_TYPE_COLORS: Record<string, string> = {
  PER_JOB: "bg-blue-100 text-blue-700",
  HOURLY: "bg-purple-100 text-purple-700",
  COMMISSION: "bg-green-100 text-green-700",
  SALARY: "bg-gray-100 text-gray-700",
};

// ─── Quick date range presets ─────────────────────────────────────────────────

const PRESETS = [
  {
    label: "This Month",
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  },
  {
    label: "Last Month",
    from: startOfMonth(subMonths(new Date(), 1)),
    to: endOfMonth(subMonths(new Date(), 1)),
  },
  {
    label: "Last 3 Months",
    from: startOfMonth(subMonths(new Date(), 2)),
    to: endOfMonth(new Date()),
  },
];

// ─── CSV Export ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exportCSV(payouts: any[], dateFrom: Date, dateTo: Date) {
  const rows: string[][] = [
    ["Photographer", "Email", "Pay Type", "Rate", "# Jobs", "Hours", "Revenue", "Payout", "Breakdown"],
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payouts.forEach((p: any) => {
    rows.push([
      p.name,
      p.email,
      PAY_TYPE_LABELS[p.payType] ?? p.payType,
      p.payType === "COMMISSION"
        ? `${p.commissionRate}%`
        : p.payRate != null
        ? `$${p.payRate}`
        : "—",
      String(p.jobCount),
      String(p.totalHours),
      `$${p.totalRevenue.toFixed(2)}`,
      `$${p.payoutAmount.toFixed(2)}`,
      p.payoutBreakdown,
    ]);
  });

  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payouts-${format(dateFrom, "yyyy-MM-dd")}-to-${format(dateTo, "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Photographer Row ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PhotographerRow({ p }: { p: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
            )}
            <div>
              <p className="font-medium text-gray-900 text-sm">{p.name}</p>
              <p className="text-xs text-gray-400">{p.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PAY_TYPE_COLORS[p.payType] ?? "bg-gray-100 text-gray-700"}`}
          >
            {PAY_TYPE_LABELS[p.payType] ?? p.payType}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 text-center">{p.jobCount}</td>
        <td className="px-4 py-3 text-sm text-gray-700 text-center">{p.totalHours}h</td>
        <td className="px-4 py-3 text-sm text-gray-500 text-right">
          {formatCurrency(p.totalRevenue)}
        </td>
        <td className="px-4 py-3 text-right">
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {formatCurrency(p.payoutAmount)}
            </p>
            <p className="text-xs text-gray-400">{p.payoutBreakdown}</p>
          </div>
        </td>
      </tr>

      {/* Expanded job list */}
      {expanded &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p.jobs.map((job: any, i: number) => (
          <tr key={i} className="bg-blue-50/40 border-b text-xs">
            <td className="pl-12 pr-4 py-2 text-gray-600" colSpan={2}>
              <span className="font-medium text-gray-800">{job.jobNumber}</span> ·{" "}
              {job.propertyAddress}
            </td>
            <td className="px-4 py-2 text-gray-500 text-center">
              {job.scheduledAt ? format(new Date(job.scheduledAt), "MMM d") : "—"}
            </td>
            <td className="px-4 py-2 text-gray-500 text-center">
              {job.estimatedDurationMins
                ? `${Math.round(job.estimatedDurationMins / 60 * 10) / 10}h`
                : "—"}
            </td>
            <td className="px-4 py-2 text-gray-500 text-right">
              {formatCurrency(job.totalAmount ?? 0)}
            </td>
            <td className="px-4 py-2 text-right">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                  job.status === "COMPLETED"
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {job.status}
              </span>
            </td>
          </tr>
        ))}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PayoutsPage() {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [activePreset, setActivePreset] = useState(0);

  const { data, isLoading } = trpc.staff.payouts.useQuery({
    dateFrom,
    dateTo,
  });

  const applyPreset = (i: number) => {
    setActivePreset(i);
    setDateFrom(PRESETS[i].from);
    setDateTo(PRESETS[i].to);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contractor Payouts</h1>
          <p className="text-sm text-gray-500">1099 earnings breakdown by photographer</p>
        </div>
        <button
          onClick={() => data?.payouts && exportCSV(data.payouts, dateFrom, dateTo)}
          disabled={!data?.payouts?.length}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Filters */}
        <div className="bg-white border rounded-xl p-4 flex flex-wrap items-center gap-4">
          {/* Preset buttons */}
          <div className="flex gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => applyPreset(i)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  activePreset === i
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-gray-500">From</label>
            <input
              type="date"
              value={format(dateFrom, "yyyy-MM-dd")}
              onChange={(e) => {
                setActivePreset(-1);
                setDateFrom(new Date(e.target.value + "T00:00:00"));
              }}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="text-xs text-gray-500">To</label>
            <input
              type="date"
              value={format(dateTo, "yyyy-MM-dd")}
              onChange={(e) => {
                setActivePreset(-1);
                setDateTo(new Date(e.target.value + "T23:59:59"));
              }}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Photographers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.payouts.length}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total Jobs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.payouts.reduce((s, p) => s + p.jobCount, 0)}
              </p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total Payouts</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(data.grandTotal)}
              </p>
            </div>
          </div>
        )}

        {/* Payout table */}
        <div className="bg-white border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : !data?.payouts?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-gray-400 text-sm">No completed jobs in this period.</p>
              <p className="text-gray-300 text-xs mt-1">
                Adjust the date range or check job statuses.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Photographer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Pay Type
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Jobs
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Hours
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Payout
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {data.payouts.map((p: any) => (
                  <PhotographerRow key={p.staffId} p={p} />
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                    Grand Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600">
                    {formatCurrency(data.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* 1099 note */}
        <p className="text-xs text-gray-400 text-center">
          This report is for internal payout tracking. Consult your accountant for 1099-NEC filing requirements. Contractors earning $600+ per year must receive a 1099-NEC.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Route, Download, MapPin, Car, ChevronDown, DollarSign, Calculator } from "lucide-react";

// IRS standard mileage rate 2025 (cents/mile)
const IRS_DEFAULT_RATE = 0.70;

const PRESETS = [
  { label: "This Month", from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
  { label: "Last Month", from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) },
  { label: "Last 3 Months", from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) },
  { label: "This Year", from: new Date(new Date().getFullYear(), 0, 1), to: new Date() },
];

export default function MileagePage() {
  const [preset, setPreset] = useState(0);
  const [dateFrom, setDateFrom] = useState(PRESETS[0].from);
  const [dateTo, setDateTo] = useState(PRESETS[0].to);
  const [irsRate, setIrsRate] = useState(String(IRS_DEFAULT_RATE));
  const [groupByStaff, setGroupByStaff] = useState(false);
  // Per-job mileage state: { [jobId]: number }
  const [jobMileage, setJobMileage] = useState<Record<string, string>>({});

  const { data, isLoading } = trpc.jobs.list.useQuery({
    page: 1,
    limit: 200,
    dateFrom,
    dateTo,
    status: undefined,
    sortBy: "scheduledAt",
    sortDir: "asc",
  });

  const jobs = useMemo(() => (data?.jobs ?? []).filter(
    (j) => ["COMPLETED", "DELIVERED", "IN_PROGRESS", "EDITING", "REVIEW"].includes(j.status)
  ), [data]);

  const rate = parseFloat(irsRate) || IRS_DEFAULT_RATE;

  const totalMiles = useMemo(() =>
    jobs.reduce((sum, j) => sum + (parseFloat(jobMileage[j.id] || "0") || 0), 0),
    [jobs, jobMileage]
  );
  const totalReimbursement = totalMiles * rate;

  // Group by primary photographer
  const grouped = useMemo(() => {
    const map: Record<string, { name: string; jobs: typeof jobs }> = {};
    jobs.forEach((j) => {
      const photographer = j.assignments[0]?.staff?.member?.user?.fullName ?? "Unassigned";
      if (!map[photographer]) map[photographer] = { name: photographer, jobs: [] };
      map[photographer].jobs.push(j);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [jobs]);

  function handlePreset(i: number) {
    setPreset(i);
    setDateFrom(PRESETS[i].from);
    setDateTo(PRESETS[i].to);
  }

  function exportCSV() {
    const rows: string[][] = [
      ["Job #", "Date", "Address", "City", "MLS #", "Photographer", "Miles", "Reimbursement"],
    ];
    jobs.forEach((j) => {
      const miles = parseFloat(jobMileage[j.id] || "0") || 0;
      rows.push([
        j.jobNumber,
        j.scheduledAt ? format(new Date(j.scheduledAt), "yyyy-MM-dd") : "",
        j.propertyAddress,
        j.propertyCity,
        j.mlsNumber ?? "",
        j.assignments[0]?.staff?.member?.user?.fullName ?? "Unassigned",
        String(miles),
        formatCurrency(miles * rate),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mileage-${format(dateFrom, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const renderJobRow = (j: (typeof jobs)[0]) => {
    const miles = parseFloat(jobMileage[j.id] || "") || 0;
    return (
      <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
        <td className="px-4 py-2.5 text-xs font-mono text-gray-500">#{j.jobNumber}</td>
        <td className="px-4 py-2.5 text-xs text-gray-500">
          {j.scheduledAt ? format(new Date(j.scheduledAt), "MMM d") : "—"}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-gray-300 shrink-0" />
            <div>
              <p className="text-sm text-gray-800 leading-tight">{j.propertyAddress}</p>
              <p className="text-xs text-gray-400">{j.propertyCity}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-500">
          {j.assignments[0]?.staff?.member?.user?.fullName ?? (
            <span className="text-gray-300">Unassigned</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.1"
              value={jobMileage[j.id] ?? ""}
              onChange={(e) => setJobMileage((prev) => ({ ...prev, [j.id]: e.target.value }))}
              placeholder="0"
              className="w-20 border border-gray-200 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">mi</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-700">
          {miles > 0 ? formatCurrency(miles * rate) : <span className="text-gray-300">—</span>}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
            <Route className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Mileage Log</h1>
            <p className="text-xs text-gray-400">Track travel for tax reimbursement</p>
          </div>
        </div>
        <button
          onClick={exportCSV}
          disabled={jobs.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Filters + IRS rate */}
        <div className="flex flex-wrap gap-3 items-start">
          {/* Date presets */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => handlePreset(i)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  preset === i ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* IRS rate */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            <Calculator className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">IRS Rate:</span>
            <span className="text-xs text-gray-400">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={irsRate}
              onChange={(e) => setIrsRate(e.target.value)}
              className="w-12 text-xs text-center border-b border-dashed border-gray-300 focus:outline-none focus:border-blue-400"
            />
            <span className="text-xs text-gray-400">/mile</span>
          </div>

          {/* Group by staff */}
          <button
            onClick={() => setGroupByStaff((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              groupByStaff ? "border-blue-300 text-blue-700 bg-blue-50" : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <Car className="h-3.5 w-3.5" /> Group by Photographer
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Jobs in Range", value: String(jobs.length), icon: Route, color: "text-blue-600 bg-blue-50" },
            { label: "Total Miles", value: `${totalMiles.toFixed(1)} mi`, icon: Car, color: "text-purple-600 bg-purple-50" },
            { label: "Est. Reimbursement", value: formatCurrency(totalReimbursement), icon: DollarSign, color: "text-green-600 bg-green-50" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="rounded-xl border border-gray-100 bg-white p-12 text-center">
            <p className="text-sm text-gray-400">Loading jobs…</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <Route className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No completed jobs in this range</p>
            <p className="text-xs text-gray-400 mt-1">Select a different date range to view mileage data.</p>
          </div>
        ) : groupByStaff ? (
          <div className="space-y-4">
            {grouped.map((group) => {
              const groupMiles = group.jobs.reduce((s, j) => s + (parseFloat(jobMileage[j.id] || "0") || 0), 0);
              return (
                <div key={group.name} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">{group.name}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{group.jobs.length} jobs</span>
                      <span className="font-medium text-purple-700">{groupMiles.toFixed(1)} mi</span>
                      <span className="font-medium text-green-700">{formatCurrency(groupMiles * rate)}</span>
                    </div>
                  </div>
                  <table className="w-full">
                    <tbody>{group.jobs.map(renderJobRow)}</tbody>
                  </table>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Job #</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Property</th>
                  <th className="px-4 py-3 text-left">Photographer</th>
                  <th className="px-4 py-3 text-left">Miles</th>
                  <th className="px-4 py-3 text-right">Reimbursement</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(renderJobRow)}
                {/* Totals row */}
                {totalMiles > 0 && (
                  <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-sm text-gray-700">Total</td>
                    <td className="px-4 py-3 text-sm text-purple-700">{totalMiles.toFixed(1)} mi</td>
                    <td className="px-4 py-3 text-sm text-green-700 text-right">{formatCurrency(totalReimbursement)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Mileage entries are per-session and not saved to your account. Export to CSV to keep a record.
          IRS standard mileage rate for 2025 is $0.70/mile.
        </p>
      </div>
    </div>
  );
}

"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface RevenueByPackageProps {
  data: Array<{
    name: string;
    revenue: number;
    count: number;
  }>;
}

const COLORS = ["#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#f97316", "#eab308", "#14b8a6"];

export function RevenueByPackage({ data }: RevenueByPackageProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No package revenue data yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
            formatter={(value: number, _: string, props: { payload: { count: number } }) => [
              `${formatCurrency(value)} · ${props.payload.count} job${props.payload.count !== 1 ? "s" : ""}`,
              "Revenue",
            ]}
          />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend rows */}
      <div className="space-y-2">
        {data.map((pkg, i) => (
          <div key={pkg.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-gray-700 truncate max-w-[160px]">{pkg.name}</span>
              <span className="text-xs text-gray-400">{pkg.count} jobs</span>
            </div>
            <span className="font-semibold text-gray-900 tabular-nums">
              {formatCurrency(pkg.revenue)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { JOB_STATUS_LABELS } from "@/lib/utils";

interface JobsBreakdownProps {
  data: Array<{
    status: string;
    count: number;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#eab308",
  CONFIRMED: "#3b82f6",
  ASSIGNED: "#6366f1",
  IN_PROGRESS: "#a855f7",
  EDITING: "#f97316",
  REVIEW: "#ec4899",
  DELIVERED: "#14b8a6",
  COMPLETED: "#22c55e",
  CANCELLED: "#ef4444",
  ON_HOLD: "#9ca3af",
};

export function JobsBreakdown({ data }: JobsBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No job data available
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: JOB_STATUS_LABELS[item.status] || item.status,
    value: item.count,
    status: item.status,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || "#9ca3af"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
          }}
          formatter={(value) => `${value} jobs`}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

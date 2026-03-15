"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

export function WorkspaceGrowthChart({
  data,
}: {
  data: { date: string; signups: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 9, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "#0a0a14",
            border: "1px solid #ffffff12",
            borderRadius: 6,
            fontSize: 11,
            color: "#e2e8f0",
          }}
          itemStyle={{ color: "#a78bfa" }}
          labelStyle={{ color: "#64748b", fontWeight: 700, fontSize: 10 }}
        />
        <Area
          type="monotone"
          dataKey="signups"
          name="New Workspaces"
          stroke="#8b5cf6"
          fill="url(#signupGrad)"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: "#8b5cf6" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({
  data,
}: {
  data: { date: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 9, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
        />
        <Tooltip
          contentStyle={{
            background: "#0a0a14",
            border: "1px solid #ffffff12",
            borderRadius: 6,
            fontSize: 11,
            color: "#e2e8f0",
          }}
          itemStyle={{ color: "#34d399" }}
          labelStyle={{ color: "#64748b", fontWeight: 700, fontSize: 10 }}
          formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
        />
        <Bar
          dataKey="revenue"
          name="Revenue"
          fill="#10b981"
          fillOpacity={0.7}
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

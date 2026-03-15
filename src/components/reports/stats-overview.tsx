"use client";

import { DollarSign, Briefcase, TrendingUp, Receipt, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface StatsOverviewProps {
  totalRevenueYTD: number;
  jobsCompleted: number;
  avgJobValue: number;
  outstandingInvoices: number;
  collectionRate?: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  prefix?: string;
}

function StatCard({ title, value, icon: Icon, iconColor, iconBg, prefix }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">
        {prefix}{value}
      </p>
    </div>
  );
}

export function StatsOverview({
  totalRevenueYTD,
  jobsCompleted,
  avgJobValue,
  outstandingInvoices,
  collectionRate,
}: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard
        title="Total Revenue (YTD)"
        value={formatCurrency(totalRevenueYTD)}
        icon={DollarSign}
        iconColor="text-green-600"
        iconBg="bg-green-50"
      />
      <StatCard
        title="Jobs Completed"
        value={jobsCompleted}
        icon={Briefcase}
        iconColor="text-blue-600"
        iconBg="bg-blue-50"
      />
      <StatCard
        title="Avg Job Value"
        value={formatCurrency(avgJobValue)}
        icon={TrendingUp}
        iconColor="text-purple-600"
        iconBg="bg-purple-50"
      />
      <StatCard
        title="Outstanding"
        value={formatCurrency(outstandingInvoices)}
        icon={Receipt}
        iconColor="text-orange-600"
        iconBg="bg-orange-50"
      />
      {collectionRate !== undefined && (
        <StatCard
          title="Collection Rate"
          value={`${collectionRate}%`}
          icon={CheckCircle}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
      )}
    </div>
  );
}

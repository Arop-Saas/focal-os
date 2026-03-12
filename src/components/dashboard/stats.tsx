import { TrendingUp, TrendingDown, Minus, Briefcase, DollarSign, Receipt, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface DashboardStatsProps {
  jobsThisMonth: number;
  jobsDelta: number;
  revenueThisMonth: number;
  revenueDelta: number;
  pendingInvoicesTotal: number;
  activeClients: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  prefix?: string;
}

function StatCard({ title, value, delta, deltaLabel, icon: Icon, iconColor, iconBg, prefix }: StatCardProps) {
  const isPositive = (delta ?? 0) >= 0;
  const TrendIcon = delta === 0 ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-gray-900 tabular-nums">
          {prefix}{value}
        </p>
        {delta !== undefined && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              isPositive
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            <TrendIcon className="h-3 w-3" />
            {Math.abs(delta)}%
          </div>
        )}
      </div>
      {deltaLabel && (
        <p className="text-xs text-muted-foreground">{deltaLabel}</p>
      )}
    </div>
  );
}

export function DashboardStats({
  jobsThisMonth,
  jobsDelta,
  revenueThisMonth,
  revenueDelta,
  pendingInvoicesTotal,
  activeClients,
}: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Jobs This Month"
        value={jobsThisMonth}
        delta={jobsDelta}
        deltaLabel="vs last month"
        icon={Briefcase}
        iconColor="text-blue-600"
        iconBg="bg-blue-50"
      />
      <StatCard
        title="Revenue This Month"
        value={formatCurrency(revenueThisMonth)}
        delta={revenueDelta}
        deltaLabel="vs last month"
        icon={DollarSign}
        iconColor="text-green-600"
        iconBg="bg-green-50"
      />
      <StatCard
        title="Outstanding Invoices"
        value={formatCurrency(pendingInvoicesTotal)}
        icon={Receipt}
        iconColor="text-orange-600"
        iconBg="bg-orange-50"
        deltaLabel="awaiting payment"
      />
      <StatCard
        title="Active Clients"
        value={activeClients}
        icon={Users}
        iconColor="text-purple-600"
        iconBg="bg-purple-50"
        deltaLabel="in your workspace"
      />
    </div>
  );
}

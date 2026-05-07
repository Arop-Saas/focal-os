import { TrendingUp, TrendingDown, Minus, Briefcase, DollarSign, Receipt, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface DashboardStatsProps {
  jobsThisMonth: number;
  jobsDelta: number;
  revenueThisMonth: number;
  revenueDelta: number;
  pendingInvoicesTotal: number;
  activeClients: number;
  weeklyRevenue?: number[];
}

// Inline SVG sparkline — server-rendered, zero client JS
function Sparkline({ data }: { data: number[] }) {
  if (!data.length || data.every((v) => v === 0)) {
    return <div className="h-8 w-20 border-b border-emerald-200 opacity-30 shrink-0" />;
  }
  const max = Math.max(...data, 1);
  const W = 80; const H = 32;
  const pts = data.map((v, i) => {
    const x = ((i / (data.length - 1)) * W).toFixed(1);
    const y = (H - (v / max) * H).toFixed(1);
    return `${x},${y}`;
  });
  const line = `M ${pts.join(" L ")}`;
  const fill = `${line} L ${W},${H} L 0,${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id="spk-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#spk-fill)" />
      <path d={line} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  icon: React.ElementType;
  accentColor: string;
  children?: React.ReactNode;
}

function StatCard({ title, value, delta, deltaLabel, icon: Icon, accentColor, children }: StatCardProps) {
  const isPositive = (delta ?? 0) >= 0;
  const TrendIcon = delta === undefined || delta === 0 ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{title}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${accentColor}`}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[26px] font-bold text-gray-900 tabular-nums leading-none tracking-tight">
            {value}
          </p>
          {deltaLabel && (
            <p className="text-[11px] text-gray-400 mt-1.5">{deltaLabel}</p>
          )}
        </div>
        {children}
      </div>

      {delta !== undefined && (
        <div className="flex items-center gap-1.5 pt-0.5 border-t border-gray-50">
          <div className={`flex items-center gap-1 text-[11px] font-semibold ${
            delta === 0 ? "text-gray-400" : isPositive ? "text-emerald-600" : "text-red-500"
          }`}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(delta)}%
          </div>
          <span className="text-[11px] text-gray-400">vs last month</span>
        </div>
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
  weeklyRevenue = [],
}: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Jobs This Month"
        value={jobsThisMonth}
        delta={jobsDelta}
        icon={Briefcase}
        accentColor="bg-blue-500"
      />
      <StatCard
        title="Revenue"
        value={formatCurrency(revenueThisMonth)}
        delta={revenueDelta}
        icon={DollarSign}
        accentColor="bg-emerald-500"
      >
        {weeklyRevenue.length > 0 && <Sparkline data={weeklyRevenue} />}
      </StatCard>
      <StatCard
        title="Outstanding"
        value={formatCurrency(pendingInvoicesTotal)}
        deltaLabel="awaiting payment"
        icon={Receipt}
        accentColor="bg-amber-500"
      />
      <StatCard
        title="Active Clients"
        value={activeClients}
        deltaLabel="in your workspace"
        icon={Users}
        accentColor="bg-violet-500"
      />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { format, subDays } from "date-fns";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, Zap, Users, Building2, DollarSign, Clock, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  sub,
  accent = "violet",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "violet" | "cyan" | "green" | "amber";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const colors = {
    violet: { border: "border-violet-500/20", glow: "shadow-violet-500/10", icon: "text-violet-400", val: "text-violet-100" },
    cyan: { border: "border-cyan-500/20", glow: "shadow-cyan-500/10", icon: "text-cyan-400", val: "text-cyan-100" },
    green: { border: "border-emerald-500/20", glow: "shadow-emerald-500/10", icon: "text-emerald-400", val: "text-emerald-100" },
    amber: { border: "border-amber-500/20", glow: "shadow-amber-500/10", icon: "text-amber-400", val: "text-amber-100" },
  }[accent];

  return (
    <div className={`relative bg-[#0d0d1a] rounded-xl border ${colors.border} p-5 shadow-lg ${colors.glow} overflow-hidden`}>
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">{label}</p>
          <Icon className={`h-4 w-4 ${colors.icon} opacity-60`} />
        </div>
        <p className={`text-3xl font-bold tracking-tight ${colors.val}`}>{value}</p>
        {sub && <p className="text-[11px] text-slate-600 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);
  const sevenDaysAgo = subDays(now, 7);

  const [
    totalWorkspaces,
    activeWorkspaces,
    trialingWorkspaces,
    newLast30,
    newLast7,
    totalUsers,
    totalJobs,
    totalInvoices,
    recentWorkspaces,
    revenueResult,
  ] = await Promise.all([
    prisma.workspace.count(),
    prisma.workspace.count({ where: { subscriptionStatus: "ACTIVE" } }),
    prisma.workspace.count({ where: { subscriptionStatus: "TRIALING" } }),
    prisma.workspace.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.workspace.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count(),
    prisma.job.count(),
    prisma.invoice.count(),
    prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        _count: { select: { jobs: true, clients: true } },
        members: {
          where: { isOwner: true },
          include: { user: { select: { email: true, fullName: true } } },
          take: 1,
        },
      },
    }),
    prisma.invoice.aggregate({
      _sum: { amountPaid: true },
      where: { status: "PAID" },
    }),
  ]);

  const totalRevenue = revenueResult._sum.amountPaid ?? 0;

  const statusColor: Record<string, string> = {
    ACTIVE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    TRIALING: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    PAST_DUE: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    CANCELED: "text-red-400 bg-red-500/10 border-red-500/20",
    PAUSED: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  };

  return (
    <div className="p-8 space-y-8 min-h-screen">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] tracking-widest uppercase text-violet-500 mb-1 font-bold">
            ◈ OPERATOR CONSOLE — LIVE
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Overview</h1>
          <p className="text-xs text-slate-600 mt-0.5 font-mono">
            {format(now, "EEEE, MMMM d yyyy · HH:mm:ss 'UTC'")}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold tracking-widest uppercase bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          All Systems Nominal
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Workspaces" value={totalWorkspaces} sub={`+${newLast30} this month`} icon={Building2} accent="violet" />
        <StatCard label="Active Subscribers" value={activeWorkspaces} sub={`${trialingWorkspaces} in trial`} icon={Zap} accent="cyan" />
        <StatCard label="Total Users" value={totalUsers} sub="across all workspaces" icon={Users} accent="green" />
        <StatCard label="Platform Revenue" value={`$${totalRevenue.toLocaleString()}`} sub="total invoiced & paid" icon={DollarSign} accent="amber" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0d0d1a] rounded-xl border border-[#ffffff08] p-5">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-3">New Signups</p>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-2xl font-bold text-white">{newLast7}</p>
              <p className="text-[10px] text-slate-600">last 7 days</p>
            </div>
            <div className="pb-0.5">
              <p className="text-xl font-bold text-slate-400">{newLast30}</p>
              <p className="text-[10px] text-slate-600">last 30 days</p>
            </div>
          </div>
        </div>
        <div className="bg-[#0d0d1a] rounded-xl border border-[#ffffff08] p-5">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-3">Jobs Created</p>
          <p className="text-2xl font-bold text-white">{totalJobs.toLocaleString()}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">across all workspaces</p>
        </div>
        <div className="bg-[#0d0d1a] rounded-xl border border-[#ffffff08] p-5">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-3">Invoices Issued</p>
          <p className="text-2xl font-bold text-white">{totalInvoices.toLocaleString()}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">across all workspaces</p>
        </div>
      </div>

      {/* Recent workspaces */}
      <div className="bg-[#0d0d1a] rounded-xl border border-[#ffffff08] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ffffff08]">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 flex items-center gap-2">
            <Activity className="h-3 w-3 text-violet-500" /> Recent Workspace Activity
          </p>
          <Link href="/admin/workspaces" className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#ffffff06]">
              {["Workspace", "Owner", "Status", "Jobs", "Clients", "Joined"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-[9px] font-bold tracking-widest uppercase text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ffffff04]">
            {recentWorkspaces.map((ws) => {
              const owner = ws.members[0]?.user;
              return (
                <tr key={ws.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/workspaces/${ws.id}`} className="font-bold text-slate-200 group-hover:text-violet-300 transition-colors flex items-center gap-1.5">
                      {ws.name}
                      <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    <p className="text-slate-600 text-[10px] font-mono">{ws.slug}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-slate-300">{owner?.fullName ?? "—"}</p>
                    <p className="text-slate-600 text-[10px]">{owner?.email ?? "—"}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded border ${statusColor[ws.subscriptionStatus] ?? statusColor.PAUSED}`}>
                      {ws.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 font-mono">{ws._count.jobs}</td>
                  <td className="px-5 py-3.5 text-slate-400 font-mono">{ws._count.clients}</td>
                  <td className="px-5 py-3.5 text-slate-600 font-mono text-[10px]">
                    {format(new Date(ws.createdAt), "MMM d, yyyy")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

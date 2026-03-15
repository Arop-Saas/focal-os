import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Briefcase, Users, Receipt, Image, CreditCard, Globe, Mail, Phone } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { WorkspaceAdminActions } from "@/components/admin/workspace-admin-actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  ACTIVE:   "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  TRIALING: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  PAST_DUE: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  CANCELED: "text-red-400 bg-red-500/10 border-red-500/20",
  PAUSED:   "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-[#ffffff06] last:border-0">
      <span className="text-[10px] font-bold tracking-widest uppercase text-slate-600 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-slate-300 font-mono">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, accent = "violet" }: { label: string; value: string | number; accent?: "violet" | "cyan" | "green" | "amber" }) {
  const val = {
    violet: "text-violet-300",
    cyan: "text-cyan-300",
    green: "text-emerald-300",
    amber: "text-amber-300",
  }[accent];
  return (
    <div className="bg-[#0d0d1a] rounded-lg border border-[#ffffff08] p-4">
      <p className="text-[9px] font-bold tracking-widest uppercase text-slate-600 mb-1.5">{label}</p>
      <p className={`text-xl font-bold ${val}`}>{value}</p>
    </div>
  );
}

export default async function AdminWorkspaceDetailPage({ params }: { params: { id: string } }) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { jobs: true, clients: true, invoices: true, galleries: true, staff: true, members: true } },
      members: {
        include: { user: { select: { id: true, fullName: true, email: true, createdAt: true, isSuperAdmin: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!workspace) notFound();

  const [revenueResult, recentJobs, recentActivity] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { totalAmount: true, amountPaid: true },
      where: { workspaceId: workspace.id },
    }),
    prisma.job.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, jobNumber: true, propertyAddress: true, status: true, scheduledAt: true, totalAmount: true },
    }),
    prisma.activityLog.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { fullName: true } } },
    }),
  ]);

  const totalInvoiced = revenueResult._sum.totalAmount ?? 0;
  const totalPaid = revenueResult._sum.amountPaid ?? 0;
  const owner = workspace.members.find((m) => m.isOwner);

  const jobStatusColor: Record<string, string> = {
    PENDING: "text-yellow-400",
    CONFIRMED: "text-blue-400",
    IN_PROGRESS: "text-purple-400",
    COMPLETED: "text-emerald-400",
    CANCELLED: "text-red-400",
  };

  return (
    <div className="p-8 space-y-6 min-h-screen">

      {/* Back + header */}
      <div>
        <Link href="/admin/workspaces" className="flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-violet-400 transition-colors mb-3 tracking-widest uppercase font-bold">
          <ArrowLeft className="h-3 w-3" /> All Workspaces
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-violet-500 mb-1 font-bold">◈ WORKSPACE DETAIL</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">{workspace.name}</h1>
            <p className="text-xs text-slate-600 mt-0.5 font-mono">/{workspace.slug}</p>
          </div>
          <span className={`text-[9px] font-bold tracking-widest uppercase px-3 py-1.5 rounded border ${statusColor[workspace.subscriptionStatus] ?? statusColor.PAUSED}`}>
            {workspace.subscriptionStatus}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-6 gap-3">
        <MiniStat label="Jobs" value={workspace._count.jobs} accent="violet" />
        <MiniStat label="Clients" value={workspace._count.clients} accent="cyan" />
        <MiniStat label="Invoices" value={workspace._count.invoices} accent="amber" />
        <MiniStat label="Galleries" value={workspace._count.galleries} accent="green" />
        <MiniStat label="Invoiced" value={`$${totalInvoiced.toLocaleString()}`} accent="amber" />
        <MiniStat label="Collected" value={`$${totalPaid.toLocaleString()}`} accent="green" />
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Left: workspace info */}
        <div className="col-span-2 space-y-5">

          {/* Info */}
          <div className="bg-[#0d0d1a] rounded-xl border border-[#ffffff08] p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-4">Workspace Info</p>
            <DataRow label="ID" value={workspace.id} />
            <DataRow label="Name" value={workspace.name} />
            <DataRow label="Slug" value={workspace.slug} />
            <DataRow label="Email" value={workspace.email ?? "—"} />
            <DataRow label="Phone" value={workspace.phone ?? "—"} />
            <DataRow label="Website" value={workspace.website ?? "—"} />
            <DataRow label="Timezone" value={workspace.timezone} />
            <DataRow label="Currency" value={workspace.currency} />
            <DataRow label="Created" value={format(new Date(workspace.createdAt), "MMM d, yyyy · HH:mm")} />
          </div>

          {/* Billing */}
          <div className="bg-[#0d0d1a] rounded-xl border border-[#ffffff08] p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-4">Billing</p>
            <DataRow label="Sub Status" value={
              <span className={`text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border ${statusColor[workspace.subscriptionStatus] ?? statusColor.PAUSED}`}>
                {workspace.subscriptionStatus}
              </span>
            } />
            <DataRow label="Stripe ID" value={workspace.stripeCustomerId ?? "—"} />
            <DataRow label="Trial Ends" value={workspace.trialEndsAt ? format(new Date(workspace.trialEndsAt), "MMM d, yyyy") : "—"} />
            <DataRow label="Sub Ends" value={workspace.subscriptionEndsAt ? format(new Date(workspace.subscriptionEndsAt), "MMM d, yyyy") : "—"} />
            <DataRow label="Stripe PK" value={workspace.stripePublishableKey ? `${workspace.stripePublishableKey.slice(0, 12)}…` : "Not configured"} />
          </div>

          {/* Recent jobs */}
          {recentJobs.length > 0 && (
            <div className="bg-[#0d0d1a] rounded-xl border border-[#ffffff08] overflow-hidden">
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-600 px-5 py-3.5 border-b border-[#ffffff08]">
                Recent Jobs
              </p>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-[#ffffff04]">
                  {recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-slate-300 font-medium truncate max-w-[200px]">{job.propertyAddress}</p>
                        <p className="text-slate-600 text-[10px] font-mono">#{job.jobNumber}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-bold ${jobStatusColor[job.status] ?? "text-slate-400"}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 font-mono text-[10px]">
                        {job.scheduledAt ? format(new Date(job.scheduledAt), "MMM d") : "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-400 font-mono">
                        {formatCurrency(job.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: members + activity */}
        <div className="space-y-5">

          {/* Members */}
          <div className="bg-[#0d0d1a] rounded-xl border border-[#ffffff08] p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-4">
              Team · {workspace._count.members}
            </p>
            <div className="space-y-3">
              {workspace.members.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-violet-900/50 flex items-center justify-center text-[10px] font-bold text-violet-400 shrink-0">
                    {m.user.fullName?.[0] ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-200 font-medium truncate">
                      {m.user.fullName}
                      {m.isOwner && <span className="ml-1.5 text-[8px] text-amber-400 font-bold tracking-widest">OWNER</span>}
                    </p>
                    <p className="text-[10px] text-slate-600 truncate">{m.user.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operator Controls */}
          <WorkspaceAdminActions
            workspaceId={workspace.id}
            currentStatus={workspace.subscriptionStatus as "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "PAUSED"}
          />

          {/* Activity */}
          {recentActivity.length > 0 && (
            <div className="bg-[#0d0d1a] rounded-xl border border-[#ffffff08] p-5">
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-4">Recent Activity</p>
              <div className="space-y-2.5">
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex gap-2.5">
                    <div className="w-1 h-1 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-slate-400 font-mono">{log.action}</p>
                      <p className="text-[10px] text-slate-600">
                        {log.user?.fullName ?? "System"} · {format(new Date(log.createdAt), "MMM d, HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

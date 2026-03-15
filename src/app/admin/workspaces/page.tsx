import prisma from "@/lib/prisma";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  ACTIVE:   "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  TRIALING: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  PAST_DUE: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  CANCELED: "text-red-400 bg-red-500/10 border-red-500/20",
  PAUSED:   "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

interface PageProps {
  searchParams: { q?: string; status?: string };
}

export default async function AdminWorkspacesPage({ searchParams }: PageProps) {
  const q = searchParams.q ?? "";
  const statusFilter = searchParams.status ?? "";

  const workspaces = await prisma.workspace.findMany({
    where: {
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }),
      ...(statusFilter && { subscriptionStatus: statusFilter as never }),
    },
    include: {
      _count: { select: { jobs: true, clients: true, invoices: true } },
      members: {
        where: { isOwner: true },
        include: { user: { select: { email: true, fullName: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const counts = await prisma.workspace.groupBy({
    by: ["subscriptionStatus"],
    _count: true,
  });
  const byStatus = Object.fromEntries(counts.map((c) => [c.subscriptionStatus, c._count]));

  return (
    <div className="p-8 space-y-6 min-h-screen">

      {/* Header */}
      <div>
        <p className="text-[10px] tracking-widest uppercase text-violet-500 mb-1 font-bold">◈ WORKSPACES</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">All Tenants</h1>
        <p className="text-xs text-slate-600 mt-0.5 font-mono">{workspaces.length} workspaces total</p>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "All", value: "" },
          { label: "Active", value: "ACTIVE" },
          { label: "Trialing", value: "TRIALING" },
          { label: "Past Due", value: "PAST_DUE" },
          { label: "Canceled", value: "CANCELED" },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/workspaces?status=${tab.value}${q ? `&q=${q}` : ""}`}
            className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded border transition-colors ${
              statusFilter === tab.value
                ? "bg-violet-600 border-violet-600 text-white"
                : "bg-transparent border-[#ffffff10] text-slate-500 hover:border-violet-500/30 hover:text-slate-300"
            }`}
          >
            {tab.label}
            {tab.value && byStatus[tab.value] ? ` (${byStatus[tab.value]})` : ""}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0d0d1a] rounded-xl border border-[#ffffff08] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#ffffff08]">
              {["Workspace", "Owner", "Status", "Jobs", "Clients", "Invoices", "Joined", ""].map((h) => (
                <th key={h} className="text-left px-5 py-3.5 text-[9px] font-bold tracking-widest uppercase text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ffffff04]">
            {workspaces.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center text-slate-600 font-mono text-xs">
                  NO WORKSPACES FOUND
                </td>
              </tr>
            ) : workspaces.map((ws) => {
              const owner = ws.members[0]?.user;
              return (
                <tr key={ws.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-200 group-hover:text-violet-300 transition-colors">{ws.name}</p>
                    <p className="text-slate-600 text-[10px] font-mono mt-0.5">{ws.slug}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-slate-300">{owner?.fullName ?? "—"}</p>
                    <p className="text-slate-600 text-[10px] mt-0.5">{owner?.email ?? "—"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded border ${statusColor[ws.subscriptionStatus] ?? statusColor.PAUSED}`}>
                      {ws.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-400 font-mono">{ws._count.jobs}</td>
                  <td className="px-5 py-4 text-slate-400 font-mono">{ws._count.clients}</td>
                  <td className="px-5 py-4 text-slate-400 font-mono">{ws._count.invoices}</td>
                  <td className="px-5 py-4 text-slate-600 font-mono text-[10px]">
                    {format(new Date(ws.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/workspaces/${ws.id}`}
                      className="flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-300 transition-colors font-bold tracking-wide uppercase opacity-0 group-hover:opacity-100"
                    >
                      Inspect <ArrowUpRight className="h-3 w-3" />
                    </Link>
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

import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { StatsOverview } from "@/components/reports/stats-overview";
import { JobsBreakdown } from "@/components/reports/jobs-breakdown";
import { TopClients } from "@/components/reports/top-clients";
import { RevenueByPackage } from "@/components/reports/revenue-by-package";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });

  const workspaceId = user!.workspaces[0].workspace.id;
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    monthlyRevenue,
    jobsByStatus,
    ytdRevenue,
    totalInvoiced,
    jobsCompleted,
    outstandingInvoices,
    totalJobRevenue,
    totalJobs,
    topClientsRaw,
    paidInvoicesWithPackage,
  ] = await Promise.all([
    // Monthly revenue last 6 months (group by date — we process in JS)
    prisma.invoice.findMany({
      where: { workspaceId, status: "PAID", paidAt: { gte: sixMonthsAgo } },
      select: { paidAt: true, totalAmount: true },
    }),
    // Jobs by status
    prisma.job.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: true,
    }),
    // YTD revenue
    prisma.invoice.aggregate({
      where: { workspaceId, status: "PAID", paidAt: { gte: startOfYear } },
      _sum: { totalAmount: true },
    }),
    // Total invoiced (all statuses except VOID/DRAFT) — for collection rate
    prisma.invoice.aggregate({
      where: { workspaceId, status: { notIn: ["VOID", "DRAFT"] } },
      _sum: { totalAmount: true },
    }),
    // Jobs completed
    prisma.job.count({ where: { workspaceId, status: { in: ["COMPLETED", "DELIVERED"] } } }),
    // Outstanding
    prisma.invoice.aggregate({
      where: { workspaceId, status: { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] } },
      _sum: { amountDue: true },
    }),
    // Avg job value numerator
    prisma.invoice.aggregate({ where: { workspaceId, status: "PAID" }, _sum: { totalAmount: true } }),
    // Total jobs
    prisma.job.count({ where: { workspaceId } }),
    // Top clients: get all paid invoices grouped by client
    prisma.invoice.findMany({
      where: { workspaceId, status: "PAID" },
      select: {
        totalAmount: true,
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    // Paid invoices with package info (via job)
    prisma.invoice.findMany({
      where: { workspaceId, status: "PAID", job: { packageId: { not: null } } },
      select: {
        totalAmount: true,
        job: {
          select: {
            package: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const avgJobValue = totalJobs > 0 ? (totalJobRevenue._sum.totalAmount ?? 0) / totalJobs : 0;

  // Build 6-month revenue chart data
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      month: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
    });
  }

  const revenueData = months.map((m) => ({
    month: m.month,
    revenue: monthlyRevenue
      .filter((r) => r.paidAt && r.paidAt >= m.start && r.paidAt < m.end)
      .reduce((sum, r) => sum + r.totalAmount, 0),
  }));

  // Jobs breakdown
  const jobsBreakdownData = jobsByStatus.map((j) => ({
    status: j.status,
    count: j._count,
  }));

  // Top clients: aggregate by client id
  const clientMap = new Map<string, { name: string; email: string; revenue: number; jobCount: number }>();
  for (const inv of topClientsRaw) {
    const c = inv.client;
    if (!c) continue;
    const existing = clientMap.get(c.id);
    if (existing) {
      existing.revenue += inv.totalAmount;
      existing.jobCount += 1;
    } else {
      clientMap.set(c.id, {
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        revenue: inv.totalAmount,
        jobCount: 1,
      });
    }
  }
  const topClients = Array.from(clientMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Revenue by package
  const packageMap = new Map<string, { name: string; revenue: number; count: number }>();
  for (const inv of paidInvoicesWithPackage) {
    const pkg = inv.job?.package;
    if (!pkg) continue;
    const existing = packageMap.get(pkg.id);
    if (existing) {
      existing.revenue += inv.totalAmount;
      existing.count += 1;
    } else {
      packageMap.set(pkg.id, { name: pkg.name, revenue: inv.totalAmount, count: 1 });
    }
  }
  const revenueByPackage = Array.from(packageMap.values()).sort((a, b) => b.revenue - a.revenue);

  // Collection rate
  const totalPaid = ytdRevenue._sum.totalAmount ?? 0;
  const totalBilled = totalInvoiced._sum.totalAmount ?? 0;
  const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Reports" description="Business analytics and performance metrics" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats Overview */}
        <StatsOverview
          totalRevenueYTD={ytdRevenue._sum.totalAmount ?? 0}
          jobsCompleted={jobsCompleted}
          avgJobValue={avgJobValue}
          outstandingInvoices={outstandingInvoices._sum.amountDue ?? 0}
          collectionRate={collectionRate}
        />

        {/* Revenue Chart */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-4">Revenue Trend — Last 6 Months</h2>
          <RevenueChart data={revenueData} />
        </div>

        {/* Two-column: Top Clients + Revenue by Package */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-[15px] font-semibold text-gray-900 mb-4">Top Clients by Revenue</h2>
            <TopClients data={topClients} />
          </div>
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-[15px] font-semibold text-gray-900 mb-4">Revenue by Package</h2>
            <RevenueByPackage data={revenueByPackage} />
          </div>
        </div>

        {/* Jobs Breakdown */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-4">Jobs by Status</h2>
          <JobsBreakdown data={jobsBreakdownData} />
        </div>
      </div>
    </div>
  );
}

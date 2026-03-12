import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { StatsOverview } from "@/components/reports/stats-overview";
import { JobsBreakdown } from "@/components/reports/jobs-breakdown";

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

  // Get monthly revenue for last 6 months
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const monthlyRevenue = await prisma.invoice.groupBy({
    by: ["paidAt"],
    where: {
      workspaceId,
      status: "PAID",
      paidAt: { gte: sixMonthsAgo },
    },
    _sum: { totalAmount: true },
  });

  // Get jobs by status
  const jobsByStatus = await prisma.job.groupBy({
    by: ["status"],
    where: { workspaceId },
    _count: true,
  });

  // Get total revenue YTD
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const ytdRevenue = await prisma.invoice.aggregate({
    where: {
      workspaceId,
      status: "PAID",
      paidAt: { gte: startOfYear },
    },
    _sum: { totalAmount: true },
  });

  // Get jobs completed
  const jobsCompleted = await prisma.job.count({
    where: {
      workspaceId,
      status: { in: ["COMPLETED", "DELIVERED"] },
    },
  });

  // Get outstanding invoices
  const outstandingInvoices = await prisma.invoice.aggregate({
    where: {
      workspaceId,
      status: { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] },
    },
    _sum: { amountDue: true },
  });

  // Calculate average job value
  const totalJobRevenue = await prisma.invoice.aggregate({
    where: { workspaceId, status: "PAID" },
    _sum: { totalAmount: true },
  });
  const totalJobs = await prisma.job.count({ where: { workspaceId } });
  const avgJobValue = totalJobs > 0 ? (totalJobRevenue._sum.totalAmount ?? 0) / totalJobs : 0;

  // Format revenue data for chart (last 6 months)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      month: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }

  const revenueData = months.map((m) => {
    const monthRevenue = monthlyRevenue.find(
      (r) =>
        r.paidAt &&
        new Date(r.paidAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) ===
          m.month
    );
    return {
      month: m.month,
      revenue: monthRevenue ? monthRevenue._sum.totalAmount ?? 0 : 0,
    };
  });

  // Format jobs breakdown
  const jobsBreakdownData = jobsByStatus.map((j) => ({
    status: j.status,
    count: j._count,
  }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Reports" description="View your business analytics and performance metrics" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats Overview */}
        <StatsOverview
          totalRevenueYTD={ytdRevenue._sum.totalAmount ?? 0}
          jobsCompleted={jobsCompleted}
          avgJobValue={avgJobValue}
          outstandingInvoices={outstandingInvoices._sum.amountDue ?? 0}
        />

        {/* Revenue Chart */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
          <RevenueChart data={revenueData} />
        </div>

        {/* Jobs Breakdown */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Jobs by Status</h2>
          <JobsBreakdown data={jobsBreakdownData} />
        </div>
      </div>
    </div>
  );
}

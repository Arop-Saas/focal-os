import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { DashboardStats } from "@/components/dashboard/stats";
import { UpcomingJobs } from "@/components/dashboard/upcoming-jobs";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { QuickActions } from "@/components/dashboard/quick-actions";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: {
      workspaces: { include: { workspace: true }, take: 1 },
    },
  });

  const workspace = user!.workspaces[0].workspace;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    jobsThisMonth,
    jobsLastMonth,
    revenueThisMonth,
    revenueLastMonth,
    pendingInvoices,
    activeClients,
    upcomingJobs,
    recentJobs,
  ] = await Promise.all([
    prisma.job.count({
      where: { workspaceId: workspace.id, scheduledAt: { gte: startOfMonth }, status: { not: "CANCELLED" } },
    }),
    prisma.job.count({
      where: { workspaceId: workspace.id, scheduledAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: { not: "CANCELLED" } },
    }),
    prisma.invoice.aggregate({
      where: { workspaceId: workspace.id, status: "PAID", paidAt: { gte: startOfMonth } },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { workspaceId: workspace.id, status: "PAID", paidAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { workspaceId: workspace.id, status: { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] } },
      _sum: { amountDue: true },
    }),
    prisma.client.count({ where: { workspaceId: workspace.id, status: "ACTIVE" } }),
    prisma.job.findMany({
      where: {
        workspaceId: workspace.id,
        scheduledAt: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        status: { in: ["CONFIRMED", "ASSIGNED", "PENDING"] },
      },
      include: {
        client: { select: { firstName: true, lastName: true, phone: true } },
        assignments: {
          where: { isPrimary: true },
          include: { staff: { include: { member: { include: { user: { select: { fullName: true, avatarUrl: true } } } } } } },
        },
        package: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 8,
    }),
    prisma.job.findMany({
      where: { workspaceId: workspace.id },
      include: { client: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);

  const revenueThisMonthVal = revenueThisMonth._sum.totalAmount ?? 0;
  const revenueLastMonthVal = revenueLastMonth._sum.totalAmount ?? 0;
  const revenueDelta = revenueLastMonthVal === 0
    ? 100
    : Math.round(((revenueThisMonthVal - revenueLastMonthVal) / revenueLastMonthVal) * 100);
  const jobsDelta = jobsLastMonth === 0
    ? 100
    : Math.round(((jobsThisMonth - jobsLastMonth) / jobsLastMonth) * 100);

  const firstName = user!.fullName.split(" ")[0];
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={`${greeting}, ${firstName} 👋`}
        description={`${workspace.name} — ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Stats */}
        <DashboardStats
          jobsThisMonth={jobsThisMonth}
          jobsDelta={jobsDelta}
          revenueThisMonth={revenueThisMonthVal}
          revenueDelta={revenueDelta}
          pendingInvoicesTotal={pendingInvoices._sum.amountDue ?? 0}
          activeClients={activeClients}
        />

        {/* Quick Actions */}
        <QuickActions />

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <UpcomingJobs jobs={upcomingJobs} />
          </div>
          <div>
            <RecentActivity jobs={recentJobs} />
          </div>
        </div>
      </div>
    </div>
  );
}

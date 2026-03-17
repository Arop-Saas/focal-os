import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { subWeeks, startOfWeek } from "date-fns";
import { Header } from "@/components/layout/header";
import { DashboardStats } from "@/components/dashboard/stats";
import { UpcomingJobs } from "@/components/dashboard/upcoming-jobs";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { JobPipeline } from "@/components/dashboard/job-pipeline";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import type { SetupStep } from "@/components/dashboard/setup-checklist";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });
  if (!user || !user.workspaces.length) redirect("/onboarding");

  const workspace = user.workspaces[0].workspace;
  const now = new Date();

  // Time boundaries
  const startOfToday    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday      = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const sevenDaysOut    = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth= new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth  = new Date(now.getFullYear(), now.getMonth(), 0);

  const jobInclude = {
    client: { select: { firstName: true, lastName: true, phone: true } },
    assignments: {
      where: { isPrimary: true },
      include: {
        staff: {
          include: {
            member: { include: { user: { select: { fullName: true, avatarUrl: true } } } },
          },
        },
      },
    },
    package: { select: { name: true } },
  } as const;

  const [
    jobsThisMonth,
    jobsLastMonth,
    revenueThisMonth,
    revenueLastMonth,
    pendingInvoices,
    activeClients,
    overdueInvoices,
    todaysJobs,
    upcomingJobs,
    jobStatusCounts,
    activityLogs,
    revenueForSparkline,
  ] = await Promise.all([
    prisma.job.count({
      where: { workspaceId: workspace.id, scheduledAt: { gte: startOfMonth }, status: { not: "CANCELLED" } },
    }),
    prisma.job.count({
      where: { workspaceId: workspace.id, scheduledAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: { not: "CANCELLED" } },
    }),
    prisma.invoice.aggregate({
      where: { workspaceId: workspace.id, status: "PAID", paidAt: { gte: startOfMonth } },
      _sum: { amountPaid: true },
    }),
    prisma.invoice.aggregate({
      where: { workspaceId: workspace.id, status: "PAID", paidAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { amountPaid: true },
    }),
    prisma.invoice.aggregate({
      where: { workspaceId: workspace.id, status: { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] } },
      _sum: { amountDue: true },
    }),
    prisma.client.count({ where: { workspaceId: workspace.id, status: "ACTIVE" } }),
    prisma.invoice.aggregate({
      where: { workspaceId: workspace.id, status: "OVERDUE" },
      _sum: { amountDue: true },
      _count: { id: true },
    }),
    prisma.job.findMany({
      where: {
        workspaceId: workspace.id,
        scheduledAt: { gte: startOfToday, lt: endOfToday },
        status: { notIn: ["CANCELLED"] },
      },
      include: jobInclude,
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.job.findMany({
      where: {
        workspaceId: workspace.id,
        scheduledAt: { gte: endOfToday, lte: sevenDaysOut },
        status: { in: ["CONFIRMED", "ASSIGNED", "PENDING"] },
      },
      include: jobInclude,
      orderBy: { scheduledAt: "asc" },
      take: 8,
    }),
    prisma.job.groupBy({
      by: ["status"],
      where: { workspaceId: workspace.id, status: { notIn: ["CANCELLED", "COMPLETED", "DELIVERED"] } },
      _count: { status: true },
    }),
    prisma.activityLog.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { user: { select: { fullName: true } } },
    }),
    prisma.invoice.findMany({
      where: { workspaceId: workspace.id, status: "PAID", paidAt: { gte: subWeeks(now, 8) } },
      select: { paidAt: true, amountPaid: true },
    }),
  ]);

  const revenueThisMonthVal  = revenueThisMonth._sum.amountPaid ?? 0;
  const revenueLastMonthVal  = revenueLastMonth._sum.amountPaid ?? 0;
  const revenueDelta = revenueLastMonthVal === 0
    ? (revenueThisMonthVal > 0 ? 100 : 0)
    : Math.round(((revenueThisMonthVal - revenueLastMonthVal) / revenueLastMonthVal) * 100);
  const jobsDelta = jobsLastMonth === 0
    ? (jobsThisMonth > 0 ? 100 : 0)
    : Math.round(((jobsThisMonth - jobsLastMonth) / jobsLastMonth) * 100);

  const weeklyRevenue: number[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = startOfWeek(subWeeks(now, i));
    const we = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000);
    const total = revenueForSparkline
      .filter((inv) => inv.paidAt && inv.paidAt >= ws && inv.paidAt < we)
      .reduce((sum, inv) => sum + inv.amountPaid, 0);
    weeklyRevenue.push(total);
  }

  // ── Setup checklist data ──────────────────────────────────────────────────
  // Only compute if workspace is less than 60 days old (no point showing to established studios)
  const workspaceAgeDays = (now.getTime() - workspace.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  let setupSteps: SetupStep[] = [];

  if (workspaceAgeDays < 60) {
    const [packageCount, staffWithAvailability] = await Promise.all([
      prisma.package.count({ where: { workspaceId: workspace.id } }),
      prisma.staffProfile.count({
        where: {
          workspaceMember: { workspaceId: workspace.id },
          availability: { some: { isAvailable: true } },
        },
      }),
    ]);

    setupSteps = [
      {
        id: "logo",
        emoji: "🎨",
        title: "Add your logo & brand color",
        description: "Personalise your client-facing gallery and booking page.",
        done: !!workspace.logoUrl,
        href: "/settings",
        cta: "Go to Settings",
      },
      {
        id: "package",
        emoji: "📦",
        title: "Create your first package",
        description: "Bundle your services into packages clients can book.",
        done: packageCount > 0,
        href: "/packages",
        cta: "Create Package",
      },
      {
        id: "availability",
        emoji: "📅",
        title: "Set your availability",
        description: "Let clients know when you're available to shoot.",
        done: staffWithAvailability > 0,
        href: "/availability",
        cta: "Set Availability",
      },
      {
        id: "client",
        emoji: "👤",
        title: "Add your first client",
        description: "Import from CSV or add clients manually.",
        done: activeClients > 0,
        href: "/clients",
        cta: "Add Clients",
      },
    ];
  }

  const bookingUrl =
    typeof process !== "undefined"
      ? `${process.env.NEXT_PUBLIC_APP_URL}/book/${workspace.slug}`
      : `/book/${workspace.slug}`;

  const firstName = user.fullName.split(" ")[0];
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const overdueCount = overdueInvoices._count.id;
  const overdueTotal = overdueInvoices._sum.amountDue ?? 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={`${greeting}, ${firstName} 👋`}
        description={`${workspace.name} — ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {overdueCount > 0 && (
          <Link
            href="/invoices"
            className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3.5 hover:bg-red-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-red-800">
                  {overdueCount} overdue invoice{overdueCount !== 1 ? "s" : ""} — ${overdueTotal.toLocaleString()} outstanding
                </p>
                <p className="text-[11px] text-red-500 mt-0.5">These clients haven&apos;t paid — click to follow up</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-red-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </Link>
        )}

        {setupSteps.length > 0 && (
          <SetupChecklist steps={setupSteps} bookingUrl={bookingUrl} />
        )}

        <DashboardStats
          jobsThisMonth={jobsThisMonth}
          jobsDelta={jobsDelta}
          revenueThisMonth={revenueThisMonthVal}
          revenueDelta={revenueDelta}
          pendingInvoicesTotal={pendingInvoices._sum.amountDue ?? 0}
          activeClients={activeClients}
          weeklyRevenue={weeklyRevenue}
        />

        <JobPipeline statusCounts={jobStatusCounts} />

        <QuickActions />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <UpcomingJobs todaysJobs={todaysJobs} upcomingJobs={upcomingJobs} />
          </div>
          <div>
            <ActivityFeed logs={activityLogs} />
          </div>
        </div>

      </div>
    </div>
  );
}

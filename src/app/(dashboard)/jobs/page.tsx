import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { Header } from "@/components/layout/header";
import { OrdersTable, type OrderRow } from "@/components/jobs/orders-table";
import { OrderViews, ORDER_VIEWS, type OrderViewKey } from "@/components/jobs/order-views";
import { JobFilters } from "@/components/jobs/job-filters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { computeOrderAttention } from "@/lib/orders/attention";
import { utcToWallDateISO, wallDayUtcRange } from "@/lib/scheduling/tz";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    page?: string;
    view?: string;
    search?: string;
    sort?: string;
  };
}

function resolveOrderBy(sort?: string): object[] {
  switch (sort) {
    case "scheduled_asc":  return [{ scheduledAt: "asc"  }, { createdAt: "asc"  }];
    case "created_desc":   return [{ createdAt: "desc" }];
    case "created_asc":    return [{ createdAt: "asc"  }];
    case "scheduled_desc":
    default:               return [{ scheduledAt: "desc" }, { createdAt: "desc" }];
  }
}

const UNPAID = ["SENT", "VIEWED", "PARTIAL", "OVERDUE"];
const PAGE_SIZE = 20;
/** Working-set cap for in-memory view derivation — revisit when volume demands */
const FETCH_CAP = 500;

export default async function OrdersPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const workspaceId = await resolveWorkspaceId(supabaseUser!.id);
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { timezone: true },
  });

  const view: OrderViewKey = (ORDER_VIEWS.some((v) => v.key === searchParams.view)
    ? searchParams.view
    : "needs_attention") as OrderViewKey;
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));

  const jobs = await prisma.job.findMany({
    where: {
      workspaceId,
      ...(searchParams.search && {
        OR: [
          { jobNumber: { contains: searchParams.search, mode: "insensitive" as const } },
          { propertyAddress: { contains: searchParams.search, mode: "insensitive" as const } },
          { client: { OR: [
            { firstName: { contains: searchParams.search, mode: "insensitive" as const } },
            { lastName: { contains: searchParams.search, mode: "insensitive" as const } },
          ]}},
        ],
      }),
    },
    include: {
      client: { select: { firstName: true, lastName: true, company: true, brokerageGroup: { select: { name: true } } } },
      services: { select: { quantity: true, service: { select: { name: true } } } },
      package: { select: { name: true } },
      assignments: {
        where: { isPrimary: true },
        select: { staff: { select: { member: { select: { user: { select: { fullName: true } } } } } } },
      },
      invoice: { select: { status: true } },
      appointments: { select: { status: true, scheduledAt: true } },
      productionTasks: { select: { status: true, dueAt: true } },
    },
    orderBy: resolveOrderBy(searchParams.sort) as never,
    take: FETCH_CAP,
  });

  // Derive stage + next action once per row, then slice into views
  const now = new Date();
  const tz = workspace?.timezone ?? "America/New_York";
  const { start: todayStart, end: todayEnd } = wallDayUtcRange(utcToWallDateISO(now, tz), tz);

  const decorated = jobs.map((job) => ({
    job,
    ...computeOrderAttention({
      jobStatus: job.status,
      scheduledAt: job.scheduledAt,
      appointments: job.appointments,
      productionTasks: job.productionTasks,
      invoiceStatus: job.invoice?.status ?? null,
      deliveredAt: job.deliveredAt,
      hasAssignment: job.assignments.length > 0,
      accessNotes: job.accessNotes,
      createdAt: job.createdAt,
      now,
    }),
  }));

  function inView(d: (typeof decorated)[number], v: OrderViewKey): boolean {
    const sched = d.job.scheduledAt;
    switch (v) {
      case "needs_attention": return d.attention.length > 0;
      case "today":       return !!sched && sched >= todayStart && sched < todayEnd && d.stage !== "CANCELLED";
      case "upcoming":    return !!sched && sched >= todayEnd && !["CANCELLED", "DELIVERED", "CLOSED"].includes(d.stage);
      case "unscheduled": return d.stage === "NEEDS_SCHEDULING";
      case "production":  return d.stage === "PRODUCTION" || d.stage === "CAPTURE";
      case "qa":          return d.stage === "QA";
      case "ready":       return d.stage === "READY";
      case "unpaid":      return d.job.invoice != null && UNPAID.includes(d.job.invoice.status);
      case "delivered":   return d.stage === "DELIVERED" || d.stage === "CLOSED";
      case "cancelled":   return d.stage === "CANCELLED";
      case "all":         return true;
    }
  }

  const counts = Object.fromEntries(
    ORDER_VIEWS.map((v) => [v.key, decorated.filter((d) => inView(d, v.key)).length])
  ) as Record<OrderViewKey, number>;

  const filtered = decorated.filter((d) => inView(d, view));
  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const rows: OrderRow[] = pageRows.map(({ job, stage, nextAction, attention }) => ({
    id: job.id,
    jobNumber: job.jobNumber,
    propertyAddress: job.propertyAddress,
    propertyCity: job.propertyCity,
    propertyState: job.propertyState,
    scheduledAt: job.scheduledAt ? job.scheduledAt.toISOString() : null,
    clientName: `${job.client.firstName} ${job.client.lastName}`,
    clientCompany: job.client.company ?? job.client.brokerageGroup?.name ?? null,
    photographer: job.assignments[0]?.staff.member.user.fullName ?? null,
    services: job.services.length > 0
      ? job.services.map((s) => (s.quantity > 1 ? `${s.service.name} ×${s.quantity}` : s.service.name))
      : job.package ? [job.package.name] : [],
    stage,
    nextAction,
    attention,
    invoiceStatus: job.invoice?.status ?? null,
    totalAmount: job.totalAmount,
  }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Orders"
        description={`${counts.all} total · ${counts.needs_attention} need attention`}
        actions={
          <Button size="sm" asChild>
            <Link href="/jobs/new"><Plus className="h-3.5 w-3.5 mr-1.5" /> New Order</Link>
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
        <OrderViews
          active={view}
          counts={counts}
          searchParams={{ search: searchParams.search, sort: searchParams.sort }}
        />
        <JobFilters currentSearch={searchParams.search} currentSort={searchParams.sort} />
        <OrdersTable rows={rows} total={total} page={page} limit={PAGE_SIZE} view={view} timezone={tz} />
      </div>
    </div>
  );
}

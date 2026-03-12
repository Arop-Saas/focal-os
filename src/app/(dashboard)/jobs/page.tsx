import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { JobsTable } from "@/components/jobs/jobs-table";
import { JobFilters } from "@/components/jobs/job-filters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: "Jobs" };

interface PageProps {
  searchParams: {
    page?: string;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export default async function JobsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });

  const workspaceId = user!.workspaces[0].workspace.id;
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = {
    workspaceId,
    ...(searchParams.status && { status: searchParams.status as any }),
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
  };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        package: { select: { name: true } },
        assignments: {
          where: { isPrimary: true },
          include: { staff: { include: { member: { include: { user: { select: { fullName: true } } } } } } },
        },
        invoice: { select: { status: true, totalAmount: true } },
      },
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.job.count({ where }),
  ]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Jobs"
        description={`${total} total jobs`}
        actions={
          <Button size="sm" asChild>
            <Link href="/jobs/new"><Plus className="h-3.5 w-3.5 mr-1.5" /> New Job</Link>
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <JobFilters currentStatus={searchParams.status} currentSearch={searchParams.search} />
        <JobsTable
          jobs={jobs}
          total={total}
          page={page}
          limit={limit}
        />
      </div>
    </div>
  );
}

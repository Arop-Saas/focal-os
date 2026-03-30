import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { Header } from "@/components/layout/header";
import { ClientsTable } from "@/components/clients/clients-table";
import { ClientFilters } from "@/components/clients/client-filters";
import { ClientsPageActions } from "@/components/clients/clients-page-actions";
import { CustomerTeamsManager } from "@/components/clients/customer-teams-manager";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata = { title: "Clients" };

interface PageProps {
  searchParams: {
    page?: string;
    status?: string;
    search?: string;
    tab?: string;
  };
}

export default async function ClientsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const workspaceId = await resolveWorkspaceId(supabaseUser!.id);
  const activeTab = searchParams.tab ?? "clients";
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = {
    workspaceId,
    ...(searchParams.status && { status: searchParams.status as any }),
    ...(searchParams.search && {
      OR: [
        { firstName: { contains: searchParams.search, mode: "insensitive" as const } },
        { lastName: { contains: searchParams.search, mode: "insensitive" as const } },
        { email: { contains: searchParams.search, mode: "insensitive" as const } },
        { company: { contains: searchParams.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        type: true,
        status: true,
        totalJobs: true,
        totalRevenue: true,
        lastJobAt: true,
        portalAccessedAt: true,
      },
    }),
    prisma.client.count({ where }),
  ]);

  const tabs = [
    { id: "clients", label: "Clients" },
    { id: "teams", label: "Teams" },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Clients"
        description={`${total} total clients`}
        actions={<ClientsPageActions />}
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-200">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={`/clients?tab=${tab.id}`}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {activeTab === "teams" ? (
          <CustomerTeamsManager />
        ) : (
          <>
            <ClientFilters currentStatus={searchParams.status} currentSearch={searchParams.search} />
            <ClientsTable
              clients={clients}
              total={total}
              page={page}
              limit={limit}
            />
          </>
        )}
      </div>
    </div>
  );
}

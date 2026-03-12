import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { ClientsTable } from "@/components/clients/clients-table";
import { ClientFilters } from "@/components/clients/client-filters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: "Clients" };

interface PageProps {
  searchParams: {
    page?: string;
    status?: string;
    search?: string;
  };
}

export default async function ClientsPage({ searchParams }: PageProps) {
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
    }),
    prisma.client.count({ where }),
  ]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Clients"
        description={`${total} total clients`}
        actions={
          <Button size="sm" asChild>
            <Link href="/clients/new">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Client
            </Link>
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <ClientFilters currentStatus={searchParams.status} currentSearch={searchParams.search} />
        <ClientsTable
          clients={clients}
          total={total}
          page={page}
          limit={limit}
        />
      </div>
    </div>
  );
}

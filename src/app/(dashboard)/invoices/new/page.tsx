import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { NewInvoiceForm } from "@/components/invoices/new-invoice-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New Invoice" };

interface PageProps {
  searchParams: { jobId?: string };
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });
  const workspaceId = user!.workspaces[0].workspace.id;

  const [clients, prefillJob] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, email: true, company: true },
      orderBy: { lastName: "asc" },
    }),
    searchParams.jobId
      ? prisma.job.findFirst({
          where: { id: searchParams.jobId, workspaceId },
          include: {
            client: { select: { id: true, firstName: true, lastName: true } },
            services: { include: { service: { select: { name: true } } } },
          },
        })
      : null,
  ]);

  // Build pre-filled line items from job services
  const prefillLineItems = prefillJob?.services.map((s) => ({
    description: `${s.service.name}${s.quantity > 1 ? ` × ${s.quantity}` : ""}`,
    quantity: s.quantity,
    unitPrice: Number(s.totalPrice) / s.quantity,
  })) ?? [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="New Invoice"
        description={prefillJob ? `From Job #${prefillJob.jobNumber}` : "Create a new invoice"}
        actions={
          <Link
            href="/invoices"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to invoices
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <NewInvoiceForm
          clients={clients}
          prefillClientId={prefillJob?.clientId}
          prefillJobId={prefillJob?.id}
          prefillLineItems={prefillLineItems}
        />
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { formatOrderNumber } from "@/lib/utils";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
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

  const workspaceId = await resolveWorkspaceId(supabaseUser!.id);

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { invoiceDueDays: true, defaultTaxRate: true },
  });

  const [clients, services, prefillJob] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, email: true, company: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.service.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, name: true, basePrice: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
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

  // Auto due date based on workspace setting
  const dueDays = workspace.invoiceDueDays ?? 30;
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + dueDays);
  const defaultDueDateStr = defaultDueDate.toISOString().split("T")[0];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="New Invoice"
        description={prefillJob ? `From Order #${formatOrderNumber(prefillJob.jobNumber)}` : "Create a new invoice"}
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
          services={services}
          prefillClientId={prefillJob?.clientId}
          prefillJobId={prefillJob?.id}
          prefillLineItems={prefillLineItems}
          defaultDueDate={defaultDueDateStr}
          defaultTaxRate={workspace.defaultTaxRate ?? 0}
        />
      </div>
    </div>
  );
}

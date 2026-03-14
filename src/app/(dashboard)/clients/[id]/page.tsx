import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { ArrowLeft, Mail, Phone, MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalInviteButton } from "@/components/clients/portal-invite-button";

export const metadata = { title: "Client Details" };

interface PageProps {
  params: {
    id: string;
  };
}

const CLIENT_TYPE_COLORS: Record<string, string> = {
  AGENT: "bg-blue-100 text-blue-800",
  BROKER: "bg-purple-100 text-purple-800",
  BUILDER: "bg-orange-100 text-orange-800",
  HOMEOWNER: "bg-green-100 text-green-800",
  PROPERTY_MANAGER: "bg-indigo-100 text-indigo-800",
  OTHER: "bg-gray-100 text-gray-800",
};

const JOB_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  ASSIGNED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  EDITING: "bg-orange-100 text-orange-800",
  REVIEW: "bg-pink-100 text-pink-800",
  DELIVERED: "bg-teal-100 text-teal-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  ON_HOLD: "bg-gray-100 text-gray-800",
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SENT: "bg-blue-100 text-blue-800",
  VIEWED: "bg-indigo-100 text-indigo-800",
  PARTIAL: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  VOID: "bg-gray-100 text-gray-500",
};

export default async function ClientDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });

  const workspace = user!.workspaces[0].workspace;
  const workspaceId = workspace.id;

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!client || client.workspaceId !== workspaceId) {
    notFound();
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="h-16 border-b bg-white flex items-center px-6 gap-4 shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900">
            {client.firstName} {client.lastName}
          </h1>
          <p className="text-xs text-muted-foreground">{client.company || client.type}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Contact Info Card */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</p>
                <span className={cn(
                  "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border mt-1",
                  CLIENT_TYPE_COLORS[client.type]
                )}>
                  {client.type}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</p>
                <p className="text-sm text-gray-900 font-medium mt-1">{client.status}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                  <Mail className="h-3 w-3" /> Email
                </p>
                <p className="text-sm text-gray-900">{client.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                  <Phone className="h-3 w-3" /> Phone
                </p>
                <p className="text-sm text-gray-900">{client.phone || "—"}</p>
              </div>
              {client.company && (
                <div className="md:col-span-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Company</p>
                  <p className="text-sm text-gray-900">{client.company}</p>
                </div>
              )}
              {client.addressLine1 && (
                <div className="md:col-span-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                    <MapPin className="h-3 w-3" /> Address
                  </p>
                  <p className="text-sm text-gray-900">
                    {client.addressLine1}{client.city && `, ${client.city}`}
                    {client.state && `, ${client.state}`} {client.postalCode}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Portal Access Card */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Client Portal Access</h2>
                <p className="text-sm text-gray-500">
                  Send {client.firstName} a magic link to access their dedicated portal — orders, invoices, and galleries in one place.
                </p>
                <Link
                  href={`/portal/${workspace.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 mt-2 font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  Preview portal
                </Link>
              </div>
              <div className="shrink-0">
                <PortalInviteButton clientId={client.id} />
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Jobs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{client.totalJobs}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(client.totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Job</p>
              <p className="text-base font-semibold text-gray-900 mt-2">
                {client.lastJobAt ? formatDate(client.lastJobAt) : "—"}
              </p>
            </div>
          </div>

          {/* Recent Jobs */}
          {client.jobs.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-900">Recent Jobs</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Address</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Scheduled</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {client.jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3.5">
                          <Link href={`/jobs/${job.id}`} className="font-medium text-blue-600 hover:underline">
                            {job.propertyAddress}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-gray-600 text-sm">
                            {job.scheduledAt ? formatDate(job.scheduledAt) : "Unscheduled"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn(
                            "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full",
                            JOB_STATUS_COLORS[job.status]
                          )}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <p className="font-medium text-gray-900">{formatCurrency(job.totalAmount)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Invoices */}
          {client.invoices.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-900">Recent Invoices</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Invoice</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Issued</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {client.invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3.5">
                          <Link href={`/invoices/${invoice.id}`} className="font-medium text-blue-600 hover:underline">
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-gray-600 text-sm">
                            {invoice.issuedAt ? formatDate(invoice.issuedAt) : "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn(
                            "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full",
                            INVOICE_STATUS_COLORS[invoice.status]
                          )}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <p className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

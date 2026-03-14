import { requirePortalSession } from "@/lib/portal-session";
import prisma from "@/lib/prisma";
import { PortalNav } from "@/components/portal/portal-nav";
import Link from "next/link";
import { format } from "date-fns";
import { Receipt, ExternalLink, CheckCircle, Clock, AlertCircle, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:         { label: "Draft",        color: "bg-gray-100 text-gray-600",    icon: <Clock className="w-3 h-3" /> },
  SENT:          { label: "Sent",         color: "bg-blue-100 text-blue-700",    icon: <Receipt className="w-3 h-3" /> },
  VIEWED:        { label: "Viewed",       color: "bg-indigo-100 text-indigo-700",icon: <Receipt className="w-3 h-3" /> },
  PARTIAL:       { label: "Partial",      color: "bg-yellow-100 text-yellow-700",icon: <Clock className="w-3 h-3" /> },
  PAID:          { label: "Paid",         color: "bg-green-100 text-green-700",  icon: <CheckCircle className="w-3 h-3" /> },
  OVERDUE:       { label: "Overdue",      color: "bg-red-100 text-red-700",      icon: <AlertCircle className="w-3 h-3" /> },
  VOID:          { label: "Void",         color: "bg-gray-100 text-gray-400",    icon: <XCircle className="w-3 h-3" /> },
  UNCOLLECTIBLE: { label: "Uncollectible",color: "bg-gray-100 text-gray-400",    icon: <XCircle className="w-3 h-3" /> },
};

export default async function PortalInvoicesPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { client, workspace } = await requirePortalSession(params.workspaceSlug);

  const invoices = await prisma.invoice.findMany({
    where: { workspaceId: workspace.id, clientId: client.id },
    orderBy: { createdAt: "desc" },
    include: { job: { select: { propertyAddress: true, jobNumber: true } } },
  });

  const totalOwed = invoices
    .filter((inv) => ["SENT", "VIEWED", "PARTIAL", "OVERDUE"].includes(inv.status))
    .reduce((sum, inv) => sum + inv.amountDue, 0);

  return (
    <div className="flex h-screen bg-gray-50">
      <PortalNav
        workspaceSlug={params.workspaceSlug}
        workspaceName={workspace.name}
        clientName={`${client.firstName} ${client.lastName}`}
        brandColor={workspace.brandColor}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
              <p className="text-sm text-gray-500 mt-0.5">{invoices.length} total invoice{invoices.length !== 1 ? "s" : ""}</p>
            </div>
            {totalOwed > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2 text-right">
                <p className="text-xs text-amber-600 font-medium">Balance Due</p>
                <p className="text-lg font-bold text-amber-700">${totalOwed.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-8">
          {invoices.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
              <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium mb-1">No invoices yet</p>
              <p className="text-sm text-gray-400">Invoices will appear here once your studio sends them.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-400 px-5 py-3.5">Invoice #</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-5 py-3.5">Property</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-5 py-3.5">Issued</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-5 py-3.5">Due</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-5 py-3.5">Amount</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-5 py-3.5">Balance</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => {
                    const cfg = statusConfig[inv.status] ?? statusConfig.DRAFT;
                    return (
                      <tr key={inv.id} className={i < invoices.length - 1 ? "border-b border-gray-50" : ""}>
                        <td className="px-5 py-3.5 font-mono text-xs text-gray-500">#{inv.invoiceNumber}</td>
                        <td className="px-5 py-3.5 text-gray-700 max-w-[180px] truncate">
                          {inv.job?.propertyAddress ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">
                          {inv.issuedAt ? format(new Date(inv.issuedAt), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">
                          {inv.dueAt ? format(new Date(inv.dueAt), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right text-gray-800 font-medium">
                          ${inv.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold">
                          {inv.amountDue > 0 ? (
                            <span className="text-amber-600">${inv.amountDue.toFixed(2)}</span>
                          ) : (
                            <span className="text-green-600">$0.00</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {inv.paymentLink && inv.status !== "PAID" && inv.status !== "VOID" && (
                            <a
                              href={inv.paymentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
                              style={{ backgroundColor: workspace.brandColor }}
                            >
                              Pay <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

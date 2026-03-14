import { requirePortalSession } from "@/lib/portal-session";
import { db } from "@/lib/db";
import { PortalNav } from "@/components/portal/portal-nav";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, Package, Receipt, Image, ArrowRight, ShoppingCart } from "lucide-react";

export const dynamic = "force-dynamic";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-purple-100 text-purple-700",
  EDITING: "bg-orange-100 text-orange-700",
  REVIEW: "bg-cyan-100 text-cyan-700",
  DELIVERED: "bg-green-100 text-green-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  ON_HOLD: "bg-gray-100 text-gray-600",
};

export default async function PortalDashboardPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { client, workspace } = await requirePortalSession(params.workspaceSlug);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayJobs, recentJobs, openInvoices] = await Promise.all([
    db.job.findMany({
      where: {
        workspaceId: workspace.id,
        clientId: client.id,
        scheduledAt: { gte: today, lt: tomorrow },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    db.job.findMany({
      where: { workspaceId: workspace.id, clientId: client.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { package: true },
    }),
    db.invoice.count({
      where: {
        workspaceId: workspace.id,
        clientId: client.id,
        status: { in: ["SENT", "OVERDUE", "PARTIAL"] },
      },
    }),
  ]);

  const base = `/portal/${params.workspaceSlug}`;

  return (
    <div className="flex h-screen bg-gray-50">
      <PortalNav
        workspaceSlug={params.workspaceSlug}
        workspaceName={workspace.name}
        clientName={`${client.firstName} ${client.lastName}`}
        brandColor={workspace.brandColor}
      />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {getGreeting()}, {client.firstName}!
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Welcome back to the {workspace.name} client portal.
              </p>
            </div>
            <Link
              href={`/book/${params.workspaceSlug}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: workspace.brandColor }}
            >
              <ShoppingCart className="w-4 h-4" />
              Place Order
            </Link>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Today's appointments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                Orders With Appointments Today
              </h2>
              <Link href={`${base}/orders`} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                View All Orders <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {todayJobs.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
                <CalendarDays className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No orders with appointments today.</p>
                <Link
                  href={`${base}/orders`}
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  View All Orders <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {todayJobs.map((job) => (
                  <div key={job.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{job.propertyAddress}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {job.scheduledAt ? format(new Date(job.scheduledAt), "h:mm aa") : "Time TBD"} · #{job.jobNumber}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {job.status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400 font-medium">Total Orders</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{client.totalJobs}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-gray-400 font-medium">Open Invoices</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{openInvoices}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Image className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-400 font-medium">Galleries</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {recentJobs.filter((j) => j.status === "DELIVERED" || j.status === "COMPLETED").length}
              </p>
            </div>
          </div>

          {/* Recent orders */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Orders</h2>
            {recentJobs.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
                <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No orders yet.</p>
                <Link
                  href={`/book/${params.workspaceSlug}`}
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Book your first shoot <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Order #</th>
                      <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Property</th>
                      <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Date</th>
                      <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((job, i) => (
                      <tr key={job.id} className={i < recentJobs.length - 1 ? "border-b border-gray-50" : ""}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">#{job.jobNumber}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium max-w-[200px] truncate">{job.propertyAddress}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {job.scheduledAt ? format(new Date(job.scheduledAt), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {job.status.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

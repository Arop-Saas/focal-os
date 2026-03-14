import { requirePortalSession } from "@/lib/portal-session";
import prisma from "@/lib/prisma";
import { PortalNav } from "@/components/portal/portal-nav";
import Link from "next/link";
import { format } from "date-fns";
import { Package, ArrowRight, ShoppingCart } from "lucide-react";

export const dynamic = "force-dynamic";

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

export default async function PortalOrdersPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { client, workspace } = await requirePortalSession(params.workspaceSlug);

  const jobs = await prisma.job.findMany({
    where: { workspaceId: workspace.id, clientId: client.id },
    orderBy: { createdAt: "desc" },
    include: { package: true, gallery: { select: { slug: true, isPublic: true } } },
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <PortalNav
        workspaceSlug={params.workspaceSlug}
        workspaceName={workspace.name}
        clientName={`${client.firstName} ${client.lastName}`}
        brandColor={workspace.brandColor}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">{jobs.length} total order{jobs.length !== 1 ? "s" : ""}</p>
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

        <div className="p-8">
          {jobs.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
              <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium mb-1">No orders yet</p>
              <p className="text-sm text-gray-400 mb-5">Book your first shoot to get started.</p>
              <Link
                href={`/book/${params.workspaceSlug}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: workspace.brandColor }}
              >
                Book a shoot <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="bg-white border border-gray-100 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-900">{job.propertyAddress}</span>
                          <span className="text-xs text-gray-400 font-mono">#{job.jobNumber}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {job.propertyCity}, {job.propertyState}
                          {job.package ? ` · ${job.package.name}` : ""}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {job.scheduledAt
                            ? `Scheduled: ${format(new Date(job.scheduledAt), "MMM d, yyyy 'at' h:mm aa")}`
                            : "Date TBD"}
                          {" · "}
                          Booked {format(new Date(job.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {job.gallery?.isPublic && (
                        <Link
                          href={`/gallery/${job.gallery.slug}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          View Gallery <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {job.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

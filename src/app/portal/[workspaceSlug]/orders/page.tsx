import { requirePortalSession } from "@/lib/portal-session";
import prisma from "@/lib/prisma";
import { PortalNav } from "@/components/portal/portal-nav";
import Link from "next/link";
import { format } from "date-fns";
import { Package, ArrowRight, ShoppingCart, CheckCircle2, Circle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

// Ordered pipeline steps (excludes off-path states like CANCELLED / ON_HOLD)
const PIPELINE_STEPS = [
  { key: "PENDING",     label: "Pending" },
  { key: "CONFIRMED",   label: "Confirmed" },
  { key: "ASSIGNED",    label: "Assigned" },
  { key: "IN_PROGRESS", label: "Shoot" },
  { key: "EDITING",     label: "Editing" },
  { key: "DELIVERED",   label: "Delivered" },
  { key: "COMPLETED",   label: "Complete" },
] as const;

type PipelineKey = (typeof PIPELINE_STEPS)[number]["key"];

function getStepIndex(status: string): number {
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

function StatusStepper({ status }: { status: string }) {
  const currentIdx = getStepIndex(status);
  const isCancelled = status === "CANCELLED" || status === "ON_HOLD";

  if (isCancelled) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
          status === "CANCELLED"
            ? "bg-red-50 text-red-600"
            : "bg-gray-100 text-gray-500"
        }`}>
          {status.replace(/_/g, " ")}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="relative flex items-center justify-between">
        {/* connecting line behind the dots */}
        <div className="absolute left-0 right-0 top-[11px] h-0.5 bg-gray-200" aria-hidden="true" />
        <div
          className="absolute left-0 top-[11px] h-0.5 bg-blue-500 transition-all duration-500"
          style={{ width: currentIdx === 0 ? "0%" : `${(currentIdx / (PIPELINE_STEPS.length - 1)) * 100}%` }}
          aria-hidden="true"
        />

        {PIPELINE_STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const current = idx === currentIdx;
          return (
            <div key={step.key} className="relative flex flex-col items-center gap-1.5 z-10">
              <div className={`flex h-5.5 w-5.5 items-center justify-center rounded-full border-2 transition-colors ${
                done
                  ? "border-blue-500 bg-blue-500"
                  : current
                  ? "border-blue-500 bg-white"
                  : "border-gray-200 bg-white"
              }`}>
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-white" />
                ) : current ? (
                  <Clock className="h-3 w-3 text-blue-500" />
                ) : (
                  <Circle className="h-3 w-3 text-gray-300" />
                )}
              </div>
              <span className={`text-[10px] font-medium leading-tight text-center whitespace-nowrap ${
                done ? "text-blue-600" : current ? "text-blue-700 font-semibold" : "text-gray-400"
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
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
                          href={`/g/${job.gallery.slug}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          View Gallery <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Progress stepper */}
                  <StatusStepper status={job.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

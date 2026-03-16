import { requirePortalSession } from "@/lib/portal-session";
import prisma from "@/lib/prisma";
import { PortalNav } from "@/components/portal/portal-nav";
import Link from "next/link";
import { format } from "date-fns";
import { Images, ArrowRight, ExternalLink, Lock, Download, Eye, Calendar, MapPin, Video } from "lucide-react";

export const dynamic = "force-dynamic";

const statusConfig: Record<string, { label: string; className: string }> = {
  PROCESSING: { label: "Processing",  className: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
  READY:      { label: "Ready",       className: "bg-blue-50 text-blue-700 border border-blue-200" },
  DELIVERED:  { label: "Delivered",   className: "bg-green-50 text-green-700 border border-green-200" },
  EXPIRED:    { label: "Expired",     className: "bg-gray-100 text-gray-500 border border-gray-200" },
  ARCHIVED:   { label: "Archived",    className: "bg-gray-100 text-gray-400 border border-gray-200" },
};

export default async function PortalGalleriesPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { client, workspace } = await requirePortalSession(params.workspaceSlug);

  const jobs = await prisma.job.findMany({
    where: { workspaceId: workspace.id, clientId: client.id },
    include: {
      gallery: {
        include: {
          media: {
            where: { isCover: true },
            take: 1,
            select: { cdnUrl: true },
          },
          _count: {
            select: { media: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const jobsWithGallery = jobs.filter((j) => j.gallery);

  // Split into delivered/accessible vs pending
  const delivered = jobsWithGallery.filter(
    (j) => j.gallery!.isPublic && (j.gallery!.status === "DELIVERED" || j.gallery!.status === "READY")
  );
  const pending = jobsWithGallery.filter(
    (j) => !j.gallery!.isPublic || (j.gallery!.status !== "DELIVERED" && j.gallery!.status !== "READY")
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <PortalNav
        workspaceSlug={params.workspaceSlug}
        workspaceName={workspace.name}
        clientName={`${client.firstName} ${client.lastName}`}
        brandColor={workspace.brandColor}
      />

      <main className="flex-1 overflow-y-auto">
        {/* Page header */}
        <div className="bg-white border-b border-gray-100 px-6 py-5">
          <h1 className="text-xl font-bold text-gray-900">Your Galleries</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {delivered.length} delivered · {pending.length} in progress
          </p>
        </div>

        <div className="p-6 max-w-5xl mx-auto space-y-8">

          {/* Empty state */}
          {jobsWithGallery.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-14 text-center shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Images className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-800 font-semibold text-lg mb-1">No galleries yet</p>
              <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
                Your delivered photos will appear here once your studio sends them.
              </p>
              <Link
                href={`/book/${params.workspaceSlug}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: workspace.brandColor }}
              >
                Book a shoot <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Delivered galleries */}
          {delivered.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
                Ready to view
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {delivered.map((job) => {
                  const gallery = job.gallery!;
                  const cover = gallery.media[0];
                  const cfg = statusConfig[gallery.status] ?? statusConfig.READY;
                  const photoCount = gallery._count.media;

                  return (
                    <div key={job.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                      {/* Cover image */}
                      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                        {cover?.cdnUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover.cdnUrl}
                            alt={job.propertyAddress}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full gap-2">
                            <Images className="w-10 h-10 text-gray-300" />
                            <span className="text-xs text-gray-400">No preview</span>
                          </div>
                        )}
                        {/* Status badge */}
                        <div className="absolute top-3 right-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.className}`}>
                            {cfg.label}
                          </span>
                        </div>
                        {/* Photo count overlay */}
                        <div className="absolute bottom-3 left-3">
                          <span className="bg-black/50 backdrop-blur text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5">
                            <Images className="w-3 h-3" /> {photoCount} files
                          </span>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-4 flex-1 flex flex-col">
                        {/* Address */}
                        <div className="flex items-start gap-2 mb-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-gray-900 leading-tight">{job.propertyAddress}</p>
                            <p className="text-xs text-gray-500">{job.propertyCity}, {job.propertyState}</p>
                          </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          {job.scheduledAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(job.scheduledAt), "MMM d, yyyy")}
                            </span>
                          )}
                          {gallery.viewCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" /> {gallery.viewCount} views
                            </span>
                          )}
                          {gallery.downloadCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Download className="w-3 h-3" /> {gallery.downloadCount}
                            </span>
                          )}
                        </div>

                        {/* Expiry warning */}
                        {gallery.expiresAt && new Date(gallery.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && (
                          <p className="text-xs text-amber-600 mt-2 font-medium">
                            ⚠ Expires {format(new Date(gallery.expiresAt), "MMM d, yyyy")}
                          </p>
                        )}

                        {/* CTA */}
                        <div className="mt-auto pt-4">
                          <a
                            href={`/g/${gallery.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white py-2.5 rounded-xl transition-opacity hover:opacity-90"
                            style={{ backgroundColor: workspace.brandColor }}
                          >
                            View Gallery <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Pending / in-progress galleries */}
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
                In progress
              </h2>
              <div className="space-y-3">
                {pending.map((job) => {
                  const gallery = job.gallery!;
                  const cfg = statusConfig[gallery.status] ?? statusConfig.PROCESSING;

                  return (
                    <div key={job.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3.5 shadow-sm flex items-center gap-4">
                      {/* Icon */}
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                        <Images className="w-5 h-5 text-gray-300" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{job.propertyAddress}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          <span>{job.propertyCity}, {job.propertyState}</span>
                          {job.scheduledAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(job.scheduledAt), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">
                You&apos;ll be notified by email when your gallery is ready.
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

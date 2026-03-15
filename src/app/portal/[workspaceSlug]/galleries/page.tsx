import { requirePortalSession } from "@/lib/portal-session";
import prisma from "@/lib/prisma";
import { PortalNav } from "@/components/portal/portal-nav";
import Link from "next/link";
import { format } from "date-fns";
import { Images, ArrowRight, ExternalLink, Lock, Download, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

const statusColors: Record<string, string> = {
  PROCESSING: "bg-yellow-100 text-yellow-700",
  READY:      "bg-blue-100 text-blue-700",
  DELIVERED:  "bg-green-100 text-green-700",
  EXPIRED:    "bg-gray-100 text-gray-500",
  ARCHIVED:   "bg-gray-100 text-gray-400",
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
          media: { where: { isCover: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const jobsWithGallery = jobs.filter((j) => j.gallery);

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
          <div>
            <h1 className="text-xl font-bold text-gray-900">Galleries</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {jobsWithGallery.length} delivered galler{jobsWithGallery.length !== 1 ? "ies" : "y"}
            </p>
          </div>
        </div>

        <div className="p-8">
          {jobsWithGallery.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
              <Images className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium mb-1">No galleries yet</p>
              <p className="text-sm text-gray-400 mb-5">
                Your delivered photos will appear here once your studio sends them.
              </p>
              <Link
                href={`/book/${params.workspaceSlug}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: workspace.brandColor }}
              >
                Book a shoot <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {jobsWithGallery.map((job) => {
                const gallery = job.gallery!;
                const coverMedia = gallery.media[0];
                const statusColor = statusColors[gallery.status] ?? "bg-gray-100 text-gray-500";

                return (
                  <div
                    key={job.id}
                    className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col"
                  >
                    {/* Thumbnail / placeholder */}
                    <div className="relative h-44 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                      {coverMedia?.cdnUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverMedia.cdnUrl}
                          alt={job.propertyAddress}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Images className="w-10 h-10 text-gray-300" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor}`}>
                          {gallery.status.charAt(0) + gallery.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                      {!gallery.isPublic && (
                        <div className="absolute top-3 left-3">
                          <span className="bg-black/50 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Private
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-sm font-semibold text-gray-900 truncate">{job.propertyAddress}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {job.propertyCity}, {job.propertyState}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Images className="w-3 h-3" /> {gallery.mediaCount} files
                        </span>
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

                      {job.scheduledAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Shot {format(new Date(job.scheduledAt), "MMM d, yyyy")}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="mt-auto pt-4">
                        {gallery.isPublic ? (
                          <a
                            href={`/g/${gallery.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white py-2 rounded-lg transition-colors"
                            style={{ backgroundColor: workspace.brandColor }}
                          >
                            View Gallery <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <div className="w-full flex items-center justify-center gap-2 text-sm font-medium text-gray-400 py-2 rounded-lg bg-gray-50 border border-gray-100 cursor-not-allowed">
                            <Lock className="w-3.5 h-3.5" /> Not yet available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { cn, formatDate } from "@/lib/utils";
import { Camera, LinkIcon, Eye, Plus, Copy, Check } from "lucide-react";

const GALLERY_STATUS_COLORS: Record<string, string> = {
  PROCESSING: "bg-yellow-100 text-yellow-800",
  READY: "bg-green-100 text-green-800",
  DELIVERED: "bg-blue-100 text-blue-800",
  EXPIRED: "bg-gray-100 text-gray-800",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export default function GalleryPage() {
  const [filter, setFilter] = useState<"all" | "PROCESSING" | "READY" | "DELIVERED" | "ARCHIVED">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: galleries = [], isLoading } = trpc.gallery.list.useQuery();

  const filtered = galleries.filter((g) => filter === "all" || g.status === filter);

  const copyLink = (slug: string, id: string) => {
    const url = `${window.location.origin}/g/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gallery</h1>
          <p className="text-sm text-gray-500">{galleries.length} total galleries</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Gallery
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "PROCESSING", "READY", "DELIVERED", "ARCHIVED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                filter === f
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              )}
            >
              {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
            <Camera className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="font-semibold text-gray-700">No galleries yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Create your first gallery to share photos with clients.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((gallery) => {
              const cover = gallery.media[0];
              return (
                <div
                  key={gallery.id}
                  className="bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="h-40 bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 relative overflow-hidden">
                    {cover?.cdnUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover.cdnUrl}
                        alt={gallery.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="h-10 w-10 text-white/40 absolute inset-0 m-auto" />
                    )}
                    <span
                      className={cn(
                        "absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full",
                        GALLERY_STATUS_COLORS[gallery.status]
                      )}
                    >
                      {gallery.status}
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 truncate">{gallery.name}</h3>
                      <p className="text-xs text-gray-500 truncate">
                        {gallery.job.client.firstName} {gallery.job.client.lastName}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {gallery.job.propertyAddress}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        {gallery.mediaCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {gallery.viewCount}
                      </span>
                      {gallery.expiresAt && (
                        <span>Exp. {formatDate(gallery.expiresAt)}</span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => copyLink(gallery.slug, gallery.id)}
                        title="Copy share link"
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        {copiedId === gallery.id ? (
                          <><Check className="h-3 w-3 text-green-500" /> Copied</>
                        ) : (
                          <><LinkIcon className="h-3 w-3" /> Copy link</>
                        )}
                      </button>
                      <Link
                        href={`/gallery/${gallery.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 hover:bg-blue-100 transition-colors font-medium"
                      >
                        <Eye className="h-3 w-3" /> Manage
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && <CreateGalleryModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ─── Create Gallery Modal ─────────────────────────────────────────────────────

function CreateGalleryModal({ onClose }: { onClose: () => void }) {
  const [jobSearch, setJobSearch] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [name, setName] = useState("");
  const utils = trpc.useUtils();

  const { data: jobsData } = trpc.jobs.list.useQuery(
    { page: 1, limit: 50, search: jobSearch || undefined },
    { enabled: true }
  );

  const createMutation = trpc.gallery.create.useMutation({
    onSuccess: () => {
      utils.gallery.list.invalidate();
      onClose();
    },
    onError: (err) => alert(err.message),
  });

  const selectedJob = jobsData?.jobs?.find((j: { id: string }) => j.id === selectedJobId);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-semibold text-gray-900">New Gallery</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Link to Job</label>
            <input
              type="text"
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
              placeholder="Search by address or job #…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {jobsData?.jobs && jobsData.jobs.length > 0 && jobSearch && (
              <div className="mt-1 border rounded-lg divide-y max-h-40 overflow-y-auto">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(jobsData.jobs as any[]).slice(0, 8).map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setName(job.propertyAddress);
                      setJobSearch(job.jobNumber);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium">{job.jobNumber}</span>{" "}
                    <span className="text-gray-500">· {job.propertyAddress}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedJob && (
              <p className="text-xs text-green-600 mt-1">
                ✓ {(selectedJob as { jobNumber: string }).jobNumber} selected
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Gallery Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 123 Main St — Photos"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              createMutation.mutate({ jobId: selectedJobId, name: name.trim() })
            }
            disabled={!selectedJobId || !name.trim() || createMutation.isPending}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating…" : "Create Gallery"}
          </button>
        </div>
      </div>
    </div>
  );
}

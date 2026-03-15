"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Camera, Upload, Eye, Send, ExternalLink } from "lucide-react";

interface GalleryInfo {
  id: string;
  slug: string;
  status: string;
  mediaCount: number;
}

interface JobGalleryCardProps {
  jobId: string;
  propertyAddress: string;
  gallery: GalleryInfo | null;
}

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  PROCESSING: { dot: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-800", label: "Processing" },
  READY:      { dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-800",     label: "Ready"      },
  DELIVERED:  { dot: "bg-green-500",  badge: "bg-green-100 text-green-800",   label: "Delivered"  },
  EXPIRED:    { dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-600",     label: "Expired"    },
  ARCHIVED:   { dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-500",     label: "Archived"   },
};

export function JobGalleryCard({ jobId, propertyAddress, gallery }: JobGalleryCardProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const createMutation = trpc.gallery.create.useMutation({
    onSuccess: (newGallery) => {
      router.push(`/gallery/${newGallery.id}`);
    },
    onError: (err) => {
      alert(err.message);
      setCreating(false);
    },
  });

  function handleCreate() {
    setCreating(true);
    createMutation.mutate({
      jobId,
      name: propertyAddress,
    });
  }

  const style = gallery ? (STATUS_STYLES[gallery.status] ?? STATUS_STYLES.PROCESSING) : null;

  return (
    <div className="bg-white rounded-xl border p-5">
      {/* Header */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Camera className="w-4 h-4 text-gray-400" />
        Gallery
      </h2>

      {gallery ? (
        <div className="space-y-3">
          {/* Status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", style!.dot)} />
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", style!.badge)}>
                {style!.label}
              </span>
            </div>
            <span className="text-xs text-gray-400 font-medium">
              {gallery.mediaCount} photo{gallery.mediaCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Action buttons */}
          <div className="space-y-1.5">
            <Link
              href={`/gallery/${gallery.id}`}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              {gallery.status === "DELIVERED" ? "Manage Gallery" : "Upload & Manage"}
            </Link>

            {gallery.status === "DELIVERED" && (
              <a
                href={`/g/${gallery.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Client Gallery
              </a>
            )}

            {gallery.status === "READY" && gallery.mediaCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <Send className="h-3.5 w-3.5 text-green-600 shrink-0" />
                <p className="text-xs text-green-700 font-medium">
                  Ready to deliver — open gallery to publish
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No gallery yet */
        <div className="space-y-3">
          <div className="flex flex-col items-center py-4 text-center">
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
              <Camera className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">No gallery yet</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Create a gallery to upload and deliver photos
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
          >
            <Upload className="h-3.5 w-3.5" />
            {creating ? "Creating…" : "Create Gallery"}
          </button>
        </div>
      )}
    </div>
  );
}

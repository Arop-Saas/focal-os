"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Camera, Link as LinkIcon, Eye } from "lucide-react";

type Gallery = {
  id: string;
  name: string;
  slug: string;
  status: "PROCESSING" | "READY" | "DELIVERED" | "EXPIRED" | "ARCHIVED";
  clientName: string;
  jobAddress: string;
  photoCount: number;
  expiresAt: Date | null;
  createdAt: Date;
};

interface GalleriesGridProps {
  galleries: Gallery[];
}

const GALLERY_STATUS_COLORS: Record<string, string> = {
  PROCESSING: "bg-yellow-100 text-yellow-800",
  READY: "bg-green-100 text-green-800",
  DELIVERED: "bg-blue-100 text-blue-800",
  EXPIRED: "bg-gray-100 text-gray-800",
  ARCHIVED: "bg-gray-100 text-gray-800",
};

const GALLERY_STATUS_LABELS: Record<string, string> = {
  PROCESSING: "Processing",
  READY: "Ready",
  DELIVERED: "Delivered",
  EXPIRED: "Expired",
  ARCHIVED: "Archived",
};

export function GalleriesGrid({ galleries }: GalleriesGridProps) {
  const [filter, setFilter] = useState<"all" | "processing" | "active" | "delivered" | "archived">("all");

  const filteredGalleries = galleries.filter((g) => {
    if (filter === "all") return true;
    if (filter === "processing") return g.status === "PROCESSING";
    if (filter === "active") return g.status === "READY";
    if (filter === "delivered") return g.status === "DELIVERED";
    if (filter === "archived") return g.status === "ARCHIVED";
    return true;
  });

  if (galleries.length === 0) {
    return (
      <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">
          <Camera className="h-12 w-12 text-gray-300 mx-auto" />
        </div>
        <p className="text-base font-semibold text-gray-700">No galleries yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first gallery to showcase your work.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "processing", "active", "delivered", "archived"] as const).map((f) => (
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
            {f === "all" && "All"}
            {f === "processing" && "Processing"}
            {f === "active" && "Active"}
            {f === "delivered" && "Delivered"}
            {f === "archived" && "Archived"}
          </button>
        ))}
      </div>

      {/* Gallery Grid */}
      {filteredGalleries.length === 0 ? (
        <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">No galleries match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGalleries.map((gallery) => (
            <div
              key={gallery.id}
              className="bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Thumbnail Placeholder */}
              <div
                className="h-40 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 flex items-center justify-center"
              >
                <Camera className="h-10 w-10 text-white opacity-40" />
              </div>

              {/* Card Content */}
              <div className="p-4 space-y-3">
                {/* Gallery Name */}
                <div>
                  <h3 className="font-semibold text-gray-900 truncate">{gallery.name}</h3>
                  <p className="text-xs text-muted-foreground">{gallery.clientName}</p>
                </div>

                {/* Address */}
                <p className="text-xs text-gray-600 truncate">{gallery.jobAddress}</p>

                {/* Photo Badge */}
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Camera className="h-3 w-3" />
                  <span>{gallery.photoCount} photos</span>
                </div>

                {/* Status Badge */}
                <div>
                  <span
                    className={cn(
                      "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full",
                      GALLERY_STATUS_COLORS[gallery.status]
                    )}
                  >
                    {GALLERY_STATUS_LABELS[gallery.status]}
                  </span>
                </div>

                {/* Expiry Date */}
                {gallery.expiresAt && (
                  <p className="text-xs text-muted-foreground">
                    Expires {formatDate(gallery.expiresAt)}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8"
                    title="Copy share link"
                  >
                    <LinkIcon className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8"
                    title="View gallery"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

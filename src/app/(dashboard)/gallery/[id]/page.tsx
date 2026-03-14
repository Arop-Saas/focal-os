"use client";

import { useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Upload,
  Trash2,
  Star,
  Globe,
  Lock,
  Eye,
  Download,
  Send,
  ArrowLeft,
  Copy,
  Check,
  X,
  Archive,
} from "lucide-react";

// ─── Upload Queue Item ────────────────────────────────────────────────────────

interface UploadItem {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  cdnUrl?: string;
}

// ─── Gallery Detail Page ──────────────────────────────────────────────────────

export default function GalleryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const galleryId = params?.id as string;

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: gallery, isLoading } = trpc.gallery.getById.useQuery(
    { id: galleryId },
    { enabled: !!galleryId }
  );

  const removeMutation = trpc.gallery.removeMedia.useMutation({
    onSuccess: () => utils.gallery.getById.invalidate({ id: galleryId }),
  });

  const setCoverMutation = trpc.gallery.setCover.useMutation({
    onSuccess: () => utils.gallery.getById.invalidate({ id: galleryId }),
  });

  const updateMutation = trpc.gallery.update.useMutation({
    onSuccess: () => utils.gallery.getById.invalidate({ id: galleryId }),
  });

  const publishMutation = trpc.gallery.publish.useMutation({
    onSuccess: () => {
      utils.gallery.getById.invalidate({ id: galleryId });
      setPublishing(false);
    },
    onError: (err) => {
      alert(err.message);
      setPublishing(false);
    },
  });

  const archiveMutation = trpc.gallery.archive.useMutation({
    onSuccess: () => router.push("/gallery"),
  });

  const addMediaMutation = trpc.gallery.addMedia.useMutation({
    onSuccess: () => utils.gallery.getById.invalidate({ id: galleryId }),
  });

  // Upload a single file
  const uploadFile = useCallback(
    async (file: File, itemId: string) => {
      setUploads((prev) =>
        prev.map((u) => (u.id === itemId ? { ...u, status: "uploading", progress: 10 } : u))
      );

      try {
        const form = new FormData();
        form.append("galleryId", galleryId);
        form.append("file", file);

        const res = await fetch("/api/gallery/upload", { method: "POST", body: form });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error ?? "Upload failed");

        setUploads((prev) =>
          prev.map((u) => (u.id === itemId ? { ...u, progress: 80 } : u))
        );

        // Register with tRPC
        await addMediaMutation.mutateAsync({
          galleryId,
          fileName: data.fileName,
          originalName: data.originalName,
          mimeType: data.mimeType,
          fileSize: data.fileSize,
          storageKey: data.storageKey,
          cdnUrl: data.cdnUrl,
          mediaType: "PHOTO",
          isCover: (gallery?.media?.length ?? 0) === 0, // first photo = cover
        });

        setUploads((prev) =>
          prev.map((u) =>
            u.id === itemId ? { ...u, status: "done", progress: 100, cdnUrl: data.cdnUrl } : u
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setUploads((prev) =>
          prev.map((u) => (u.id === itemId ? { ...u, status: "error", error: msg } : u))
        );
      }
    },
    [galleryId, gallery?.media?.length, addMediaMutation]
  );

  const queueFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const items: UploadItem[] = arr.map((f) => ({
        id: `${Date.now()}-${Math.random()}`,
        file: f,
        status: "queued",
        progress: 0,
      }));
      setUploads((prev) => [...prev, ...items]);
      // Upload sequentially
      items.reduce(
        (chain, item) => chain.then(() => uploadFile(item.file, item.id)),
        Promise.resolve()
      );
    },
    [uploadFile]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    queueFiles(e.dataTransfer.files);
  };

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/g/${gallery?.slug}`
      : `/g/${gallery?.slug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">Gallery not found.</div>
    );
  }

  const isDelivered = gallery.status === "DELIVERED";
  const isArchived = gallery.status === "ARCHIVED";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/gallery")}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">{gallery.name}</h1>
            <p className="text-xs text-gray-500">
              {gallery.job.client.firstName} {gallery.job.client.lastName} ·{" "}
              {gallery.job.propertyAddress}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${
              isDelivered
                ? "bg-blue-100 text-blue-800"
                : isArchived
                ? "bg-gray-100 text-gray-600"
                : gallery.status === "READY"
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {gallery.status}
          </span>

          {/* Share link */}
          <div className="flex items-center gap-1 bg-gray-50 border rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500 max-w-[180px] truncate">{shareUrl}</span>
            <button
              onClick={copyLink}
              className="text-blue-600 hover:text-blue-700 shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Preview */}
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-500 hover:text-gray-700 border rounded-lg transition-colors"
            title="Preview gallery"
          >
            <Eye className="h-4 w-4" />
          </a>

          {/* Publish */}
          {!isDelivered && !isArchived && (
            <button
              onClick={() => {
                setPublishing(true);
                publishMutation.mutate({ id: galleryId });
              }}
              disabled={publishing || gallery.mediaCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {publishing ? "Publishing…" : "Publish & Deliver"}
            </button>
          )}

          {/* Archive */}
          {!isArchived && (
            <button
              onClick={() => {
                if (confirm("Archive this gallery? It will become inaccessible to clients.")) {
                  archiveMutation.mutate({ id: galleryId });
                }
              }}
              className="p-1.5 text-gray-400 hover:text-red-500 border rounded-lg transition-colors"
              title="Archive gallery"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-4 gap-6">
          {/* Left — Photos (3 cols) */}
          <div className="col-span-3 space-y-4">
            {/* Drop Zone */}
            {!isDelivered && !isArchived && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 bg-gray-50"
                }`}
              >
                <Upload className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">
                  Drop photos here or <span className="text-blue-600">click to browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  JPEG, PNG, WebP, HEIC · Max 25MB each
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/tiff"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && queueFiles(e.target.files)}
                />
              </div>
            )}

            {/* Upload queue */}
            {uploads.length > 0 && (
              <div className="space-y-2">
                {uploads.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 bg-white border rounded-lg px-4 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{u.file.name}</p>
                      {u.status === "uploading" && (
                        <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${u.progress}%` }}
                          />
                        </div>
                      )}
                      {u.status === "error" && (
                        <p className="text-xs text-red-500 mt-0.5">{u.error}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs shrink-0 ${
                        u.status === "done"
                          ? "text-green-600"
                          : u.status === "error"
                          ? "text-red-500"
                          : u.status === "uploading"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                    >
                      {u.status === "done" ? "✓ Done" : u.status === "error" ? "Failed" : u.status === "uploading" ? "Uploading…" : "Queued"}
                    </span>
                    {(u.status === "done" || u.status === "error") && (
                      <button
                        onClick={() => setUploads((prev) => prev.filter((x) => x.id !== u.id))}
                        className="text-gray-300 hover:text-gray-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Photo grid */}
            {gallery.media.length === 0 ? (
              <div className="bg-white border rounded-xl py-16 text-center text-gray-400 text-sm">
                No photos yet. Upload photos above to get started.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {gallery.media.map((photo) => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-[4/3]">
                    {photo.cdnUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.cdnUrl}
                        alt={photo.originalName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        No preview
                      </div>
                    )}

                    {/* Cover badge */}
                    {photo.isCover && (
                      <span className="absolute top-2 left-2 text-[10px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-semibold">
                        Cover
                      </span>
                    )}

                    {/* Action overlay */}
                    {!isDelivered && !isArchived && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        {!photo.isCover && (
                          <button
                            onClick={() =>
                              setCoverMutation.mutate({ mediaId: photo.id, galleryId })
                            }
                            title="Set as cover"
                            className="p-1.5 bg-white/90 rounded-lg text-yellow-600 hover:bg-white transition-colors"
                          >
                            <Star className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm("Remove this photo?")) {
                              removeMutation.mutate({ mediaId: photo.id, galleryId });
                            }
                          }}
                          title="Remove photo"
                          className="p-1.5 bg-white/90 rounded-lg text-red-500 hover:bg-white transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — Settings (1 col) */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Photos</span>
                  <span className="font-medium">{gallery.mediaCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Views</span>
                  <span className="font-medium">{gallery.viewCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Downloads</span>
                  <span className="font-medium">{gallery.downloadCount}</span>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="bg-white border rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Settings</h3>

              {/* Public toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  {gallery.isPublic ? (
                    <Globe className="h-4 w-4 text-green-500" />
                  ) : (
                    <Lock className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm text-gray-700">Public access</span>
                </div>
                <button
                  onClick={() =>
                    updateMutation.mutate({ id: galleryId, isPublic: !gallery.isPublic })
                  }
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    gallery.isPublic ? "bg-blue-600" : "bg-gray-200"
                  }`}
                  disabled={isArchived}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      gallery.isPublic ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </label>

              {/* Download toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Allow downloads</span>
                </div>
                <button
                  onClick={() =>
                    updateMutation.mutate({
                      id: galleryId,
                      downloadEnabled: !gallery.downloadEnabled,
                    })
                  }
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    gallery.downloadEnabled ? "bg-blue-600" : "bg-gray-200"
                  }`}
                  disabled={isArchived}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      gallery.downloadEnabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </label>

              {/* Password */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Password (optional)</label>
                <input
                  type="text"
                  defaultValue={gallery.password ?? ""}
                  placeholder="Leave blank for no password"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onBlur={(e) =>
                    updateMutation.mutate({
                      id: galleryId,
                      password: e.target.value.trim() || null,
                    })
                  }
                  disabled={isArchived}
                />
              </div>
            </div>

            {/* Client */}
            <div className="bg-white border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Client</h3>
              <p className="text-sm text-gray-700">
                {gallery.job.client.firstName} {gallery.job.client.lastName}
              </p>
              <p className="text-xs text-gray-500">{gallery.job.client.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Copy,
  Check,
  X,
  Archive,
  Video,
  Compass,
  Link2,
  Play,
  ExternalLink,
  ImageIcon,
  LayoutTemplate,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

interface UploadItem {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  cdnUrl?: string | null;
  mediaTypeHint?: string;
}

type MediaSection = "photos" | "videos" | "tours" | "floorplans" | "other";

// ─── Helpers ───────────────────────────────────────────────────────────────

function detectProvider(url: string): { label: string; icon: string } {
  const lower = url.toLowerCase();
  if (lower.includes("matterport.com")) return { label: "Matterport 3D Tour", icon: "🏠" };
  if (lower.includes("iguide.ca") || lower.includes("iguide.com")) return { label: "iGuide Tour", icon: "📐" };
  if (lower.includes("kuula.co")) return { label: "Kuula Tour", icon: "🔭" };
  return { label: "Virtual Tour", icon: "🌐" };
}

/** Convert a share URL to an embed URL where possible */
function toEmbedUrl(url: string): string {
  // Matterport: https://my.matterport.com/show/?m=MODEL_ID → embed variant
  const mpMatch = url.match(/my\.matterport\.com\/show\/\?m=([A-Za-z0-9]+)/);
  if (mpMatch) return `https://my.matterport.com/show/?m=${mpMatch[1]}&play=1&qs=1&help=0&brand=0`;
  // iGuide embed — the share URL IS the embed URL
  return url;
}

// ─── Gallery Detail Page ───────────────────────────────────────────────────

export function ListingManager({ galleryId }: { galleryId: string }) {
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<MediaSection>("photos");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tourUrl, setTourUrl] = useState("");
  const [tourLabel, setTourLabel] = useState("");
  const [addingTour, setAddingTour] = useState(false);
  const [previewTour, setPreviewTour] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const floorplanInputRef = useRef<HTMLInputElement>(null);
  const otherInputRef = useRef<HTMLInputElement>(null);
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
  const archiveMutation = trpc.gallery.archive.useMutation({
    onSuccess: () => router.refresh(),
  });
  const addMediaMutation = trpc.gallery.addMedia.useMutation({
    onSuccess: () => utils.gallery.getById.invalidate({ id: galleryId }),
  });
  const addVirtualTourMutation = trpc.gallery.addVirtualTour.useMutation({
    onSuccess: () => {
      utils.gallery.getById.invalidate({ id: galleryId });
      setTourUrl("");
      setTourLabel("");
      setAddingTour(false);
    },
    onError: (err) => { alert(err.message); setAddingTour(false); },
  });

  // Upload a single file — uses presigned URL so large videos bypass Vercel's body limit
  const uploadFile = useCallback(
    async (file: File, itemId: string, mediaTypeHint?: string) => {
      setUploads((prev) =>
        prev.map((u) => (u.id === itemId ? { ...u, status: "uploading", progress: 5 } : u))
      );
      try {
        // Step 1: Get a presigned upload URL from our API (tiny JSON payload, no file)
        const urlRes = await fetch("/api/gallery/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            galleryId,
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            ...(mediaTypeHint ? { mediaTypeHint } : {}),
          }),
        });
        const urlData = await urlRes.json() as {
          signedUrl: string; token: string; storageKey: string; cdnUrl: string | null;
          fileName: string; originalName: string; mimeType: string; fileSize: number; mediaType: string;
          error?: string;
        };
        if (!urlRes.ok) throw new Error(urlData.error ?? "Could not get upload URL");

        setUploads((prev) =>
          prev.map((u) => (u.id === itemId ? { ...u, progress: 15 } : u))
        );

        // Step 2: Upload the file directly to Supabase Storage via XHR (bypasses Vercel, enables progress)
        // Supabase storage expects multipart FormData with cacheControl + file at key ""
        await new Promise<void>((resolve, reject) => {
          const formBody = new FormData();
          formBody.append("cacheControl", "3600");
          formBody.append("", file);          // Supabase SDK uses empty-string key for the file

          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 75) + 15;
              setUploads((prev) =>
                prev.map((u) => (u.id === itemId ? { ...u, progress: Math.min(pct, 90) } : u))
              );
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              let msg = `Upload failed (${xhr.status})`;
              try { msg = (JSON.parse(xhr.responseText) as { message?: string }).message ?? msg; } catch { /* ignore */ }
              reject(new Error(msg));
            }
          });
          xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
          xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));
          xhr.open("PUT", urlData.signedUrl);
          // Do NOT set Content-Type — browser sets it automatically for FormData (includes boundary)
          xhr.send(formBody);
        });

        setUploads((prev) =>
          prev.map((u) => (u.id === itemId ? { ...u, progress: 92 } : u))
        );

        // Step 3: Register the uploaded file in our database via tRPC
        const isFirstPhoto =
          (gallery?.media?.filter((m) => m.mediaType === "PHOTO").length ?? 0) === 0;

        await addMediaMutation.mutateAsync({
          galleryId,
          fileName: urlData.fileName,
          originalName: urlData.originalName,
          mimeType: urlData.mimeType,
          fileSize: urlData.fileSize,
          storageKey: urlData.storageKey,
          cdnUrl: urlData.cdnUrl,
          mediaType: urlData.mediaType as "PHOTO" | "VIDEO" | "DRONE_VIDEO" | "FLOOR_PLAN",
          isCover: urlData.mediaType === "PHOTO" && isFirstPhoto,
        });

        setUploads((prev) =>
          prev.map((u) =>
            u.id === itemId ? { ...u, status: "done", progress: 100, cdnUrl: urlData.cdnUrl } : u
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setUploads((prev) =>
          prev.map((u) => (u.id === itemId ? { ...u, status: "error", error: msg } : u))
        );
      }
    },
    [galleryId, gallery?.media, addMediaMutation]
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
      items.reduce(
        (chain, item) => chain.then(() => uploadFile(item.file, item.id)),
        Promise.resolve()
      );
    },
    [uploadFile]
  );

  const queueFloorplanFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const items: UploadItem[] = arr.map((f) => ({
        id: `${Date.now()}-${Math.random()}`,
        file: f,
        status: "queued",
        progress: 0,
        mediaTypeHint: "FLOOR_PLAN",
      }));
      setUploads((prev) => [...prev, ...items]);
      items.reduce(
        (chain, item) => chain.then(() => uploadFile(item.file, item.id, "FLOOR_PLAN")),
        Promise.resolve()
      );
    },
    [uploadFile]
  );

  const queueOtherFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const items: UploadItem[] = arr.map((f) => ({
        id: `${Date.now()}-${Math.random()}`,
        file: f,
        status: "queued",
        progress: 0,
        mediaTypeHint: "DOCUMENT",
      }));
      setUploads((prev) => [...prev, ...items]);
      items.reduce(
        (chain, item) => chain.then(() => uploadFile(item.file, item.id, "DOCUMENT")),
        Promise.resolve()
      );
    },
    [uploadFile]
  );

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
    return <div className="flex-1 flex items-center justify-center text-gray-500">Gallery not found.</div>;
  }

  const isDelivered = gallery.status === "DELIVERED";
  const isArchived = gallery.status === "ARCHIVED";
  const canEdit = !isArchived;

  const photos     = gallery.media.filter((m) => m.mediaType === "PHOTO" || m.mediaType === "DRONE_PHOTO");
  const videos     = gallery.media.filter((m) => m.mediaType === "VIDEO" || m.mediaType === "DRONE_VIDEO");
  const tours      = gallery.media.filter((m) => m.mediaType === "VIRTUAL_TOUR");
  const floorplans = gallery.media.filter((m) => m.mediaType === "FLOOR_PLAN");
  const documents  = gallery.media.filter((m) => m.mediaType === "DOCUMENT");

  const sectionTabs: { key: MediaSection; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "photos",     label: "Photos",        icon: <ImageIcon className="h-3.5 w-3.5" />,     count: photos.length },
    { key: "videos",     label: "Videos",        icon: <Video className="h-3.5 w-3.5" />,         count: videos.length },
    { key: "tours",      label: "Virtual Tours", icon: <Compass className="h-3.5 w-3.5" />,       count: tours.length },
    { key: "floorplans", label: "Floorplans",    icon: <LayoutTemplate className="h-3.5 w-3.5" />, count: floorplans.length },
    { key: "other",      label: "Other",         icon: <Paperclip className="h-3.5 w-3.5" />,      count: documents.length },
  ];

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* ── Header ── */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-semibold text-gray-900">{gallery.name}</h1>
            <p className="text-xs text-gray-500">
              {gallery.job.client.firstName} {gallery.job.client.lastName} · {gallery.job.propertyAddress}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status badge */}
          <span className={cn(
            "text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide",
            isDelivered ? "bg-blue-100 text-blue-800" :
            isArchived  ? "bg-gray-100 text-gray-600" :
            gallery.status === "READY" ? "bg-green-100 text-green-800" :
            "bg-yellow-100 text-yellow-800"
          )}>
            {gallery.status}
          </span>

          {/* Share link */}
          <div className="flex items-center gap-1 bg-gray-50 border rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500 max-w-[180px] truncate">{shareUrl}</span>
            <button onClick={copyLink} className="text-blue-600 hover:text-blue-700 shrink-0">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          <a href={shareUrl} target="_blank" rel="noopener noreferrer"
            className="p-1.5 text-gray-500 hover:text-gray-700 border rounded-lg transition-colors" title="Preview gallery">
            <Eye className="h-4 w-4" />
          </a>

          {!isArchived && (
            <button
              onClick={() => { if (confirm("Archive this gallery? It will become inaccessible to clients.")) archiveMutation.mutate({ id: galleryId }); }}
              className="p-1.5 text-gray-400 hover:text-red-500 border rounded-lg transition-colors" title="Archive gallery"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-4 gap-6">

          {/* ── Left panel (3 cols) ── */}
          <div className="col-span-3 space-y-4">

            {/* Section tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {sectionTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveSection(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    activeSection === tab.key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      activeSection === tab.key ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── PHOTOS section ── */}
            {activeSection === "photos" && (
              <div className="space-y-4">
                {canEdit && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); queueFiles(e.dataTransfer.files); }}
                    onClick={() => photoInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                      isDragging ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"
                    )}
                  >
                    <ImageIcon className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">
                      Drop photos here or <span className="text-blue-600">click to browse</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP, HEIC, TIFF · Max 25 MB each</p>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/tiff"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && queueFiles(e.target.files)}
                    />
                  </div>
                )}

                <UploadQueue uploads={uploads.filter((u) => !u.file.type.startsWith("video/") && u.mediaTypeHint !== "FLOOR_PLAN" && u.mediaTypeHint !== "DOCUMENT")} onDismiss={(id) => setUploads((p) => p.filter((x) => x.id !== id))} />

                {photos.length === 0 ? (
                  <EmptyState icon={<ImageIcon className="h-10 w-10 text-gray-200" />} label="No photos yet" sub="Upload photos above to get started." />
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-[4/3]">
                        {photo.cdnUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo.cdnUrl} alt={photo.originalName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No preview</div>
                        )}
                        {photo.isCover && (
                          <span className="absolute top-2 left-2 text-[10px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-semibold">Cover</span>
                        )}
                        {canEdit && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                            {!photo.isCover && (
                              <button onClick={() => setCoverMutation.mutate({ mediaId: photo.id, galleryId })} title="Set as cover"
                                className="p-1.5 bg-white/90 rounded-lg text-yellow-600 hover:bg-white transition-colors">
                                <Star className="h-4 w-4" />
                              </button>
                            )}
                            <button onClick={() => { if (confirm("Remove this photo?")) removeMutation.mutate({ mediaId: photo.id, galleryId }); }}
                              title="Remove photo" className="p-1.5 bg-white/90 rounded-lg text-red-500 hover:bg-white transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── VIDEOS section ── */}
            {activeSection === "videos" && (
              <div className="space-y-4">
                {canEdit && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); queueFiles(e.dataTransfer.files); }}
                    onClick={() => videoInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                      isDragging ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"
                    )}
                  >
                    <Video className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">
                      Drop videos here or <span className="text-purple-600">click to browse</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">MP4, MOV, AVI, MKV, WebM · Max 500 MB each</p>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && queueFiles(e.target.files)}
                    />
                  </div>
                )}

                <UploadQueue uploads={uploads.filter((u) => u.file.type.startsWith("video/"))} onDismiss={(id) => setUploads((p) => p.filter((x) => x.id !== id))} />

                {videos.length === 0 ? (
                  <EmptyState icon={<Video className="h-10 w-10 text-gray-200" />} label="No videos yet" sub="Upload walkthrough or drone footage here." />
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {videos.map((video) => (
                      <div key={video.id} className="relative group rounded-xl overflow-hidden bg-gray-900">
                        {video.cdnUrl ? (
                          <video
                            src={video.cdnUrl}
                            className="w-full aspect-video object-cover"
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <div className="w-full aspect-video flex items-center justify-center">
                            <Play className="h-12 w-12 text-white/30" />
                          </div>
                        )}
                        <div className="p-2 bg-gray-900 text-white">
                          <p className="text-xs font-medium truncate">{video.originalName}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {(video.fileSize / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => { if (confirm("Remove this video?")) removeMutation.mutate({ mediaId: video.id, galleryId }); }}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove video"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── FLOORPLANS section ── */}
            {activeSection === "floorplans" && (
              <div className="space-y-4">
                {canEdit && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); queueFloorplanFiles(e.dataTransfer.files); }}
                    onClick={() => floorplanInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                      isDragging ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"
                    )}
                  >
                    <LayoutTemplate className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">
                      Drop floor plans here or <span className="text-orange-600">click to browse</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP, HEIC, TIFF · Max 25 MB each</p>
                    <input
                      ref={floorplanInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/tiff"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && queueFloorplanFiles(e.target.files)}
                    />
                  </div>
                )}

                <UploadQueue uploads={uploads.filter((u) => u.mediaTypeHint === "FLOOR_PLAN")} onDismiss={(id) => setUploads((p) => p.filter((x) => x.id !== id))} />

                {floorplans.length === 0 ? (
                  <EmptyState icon={<LayoutTemplate className="h-10 w-10 text-gray-200" />} label="No floor plans yet" sub="Upload floor plan images above to get started." />
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {floorplans.map((fp) => (
                      <div key={fp.id} className="relative group rounded-xl overflow-hidden bg-gray-100 border">
                        {fp.cdnUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fp.cdnUrl} alt={fp.originalName} className="w-full object-contain max-h-72" />
                        ) : (
                          <div className="w-full h-48 flex items-center justify-center text-gray-400 text-xs">No preview</div>
                        )}
                        <div className="px-3 py-2 bg-white border-t">
                          <p className="text-xs font-medium text-gray-700 truncate">{fp.originalName}</p>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => { if (confirm("Remove this floor plan?")) removeMutation.mutate({ mediaId: fp.id, galleryId }); }}
                            className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove floor plan"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── OTHER FILES section ── */}
            {activeSection === "other" && (
              <div className="space-y-4">
                {canEdit && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); queueOtherFiles(e.dataTransfer.files); }}
                    onClick={() => otherInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                      isDragging ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"
                    )}
                  >
                    <Paperclip className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">
                      Drop any files here or <span className="text-teal-600">click to browse</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDFs, documents, archives — any file type · Max 500 MB each</p>
                    <input
                      ref={otherInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && queueOtherFiles(e.target.files)}
                    />
                  </div>
                )}

                <UploadQueue uploads={uploads.filter((u) => u.mediaTypeHint === "DOCUMENT")} onDismiss={(id) => setUploads((p) => p.filter((x) => x.id !== id))} />

                {documents.length === 0 ? (
                  <EmptyState icon={<Paperclip className="h-10 w-10 text-gray-200" />} label="No other files yet" sub="Upload disclosures, brochures, or anything else that belongs with this listing." />
                ) : (
                  <div className="bg-white border rounded-xl divide-y">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 px-4 py-3 group">
                        <Paperclip className="h-4 w-4 text-gray-300 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{doc.originalName}</p>
                          <p className="text-[11px] text-gray-400">{(doc.fileSize / (1024 * 1024)).toFixed(1)} MB</p>
                        </div>
                        {doc.cdnUrl && (
                          <a href={doc.cdnUrl} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="Download">
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => { if (confirm("Remove this file?")) removeMutation.mutate({ mediaId: doc.id, galleryId }); }}
                            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Remove file"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── VIRTUAL TOURS section ── */}
            {activeSection === "tours" && (
              <div className="space-y-4">
                {/* Add tour form */}
                {canEdit && (
                  <div className="bg-white border rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Compass className="h-4 w-4 text-blue-500" />
                      <h3 className="text-sm font-semibold text-gray-900">Add Virtual Tour</h3>
                    </div>

                    {/* Provider logos */}
                    <div className="flex gap-3">
                      {[
                        { name: "Matterport", color: "border-blue-200 bg-blue-50 text-blue-700", placeholder: "https://my.matterport.com/show/?m=..." },
                        { name: "iGuide",     color: "border-green-200 bg-green-50 text-green-700", placeholder: "https://tours.iguide.ca/tour/..." },
                        { name: "Other",      color: "border-gray-200 bg-gray-50 text-gray-600", placeholder: "Any embeddable tour URL" },
                      ].map((p) => (
                        <div key={p.name} className={cn("px-3 py-1.5 rounded-lg border text-xs font-semibold", p.color)}>
                          {p.name}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="relative">
                        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="url"
                          value={tourUrl}
                          onChange={(e) => setTourUrl(e.target.value)}
                          placeholder="Paste your Matterport, iGuide, or any tour URL here…"
                          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <input
                        type="text"
                        value={tourLabel}
                        onChange={(e) => setTourLabel(e.target.value)}
                        placeholder={`Label (optional) — e.g. "${tourUrl ? detectProvider(tourUrl).label : "Matterport 3D Tour"}"`}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex gap-2">
                      {tourUrl && (
                        <button
                          onClick={() => setPreviewTour(previewTour ? null : tourUrl)}
                          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          {previewTour ? "Hide preview" : "Preview"}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (!tourUrl.trim()) return;
                          setAddingTour(true);
                          addVirtualTourMutation.mutate({
                            galleryId,
                            url: tourUrl.trim(),
                            label: tourLabel.trim() || undefined,
                          });
                        }}
                        disabled={!tourUrl.trim() || addingTour}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ml-auto"
                      >
                        <Compass className="h-4 w-4" />
                        {addingTour ? "Saving…" : "Save Tour"}
                      </button>
                    </div>

                    {/* Inline preview */}
                    {previewTour && (
                      <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                        <iframe
                          src={toEmbedUrl(previewTour)}
                          className="w-full aspect-video"
                          allowFullScreen
                          allow="xr-spatial-tracking; gyroscope; accelerometer"
                          title="Tour preview"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Saved tours */}
                {tours.length === 0 ? (
                  <EmptyState
                    icon={<Compass className="h-10 w-10 text-gray-200" />}
                    label="No virtual tours yet"
                    sub="Paste a Matterport or iGuide link above to attach a 3D tour."
                  />
                ) : (
                  <div className="space-y-3">
                    {tours.map((tour) => {
                      const provider = detectProvider(tour.cdnUrl ?? "");
                      const embedUrl = toEmbedUrl(tour.cdnUrl ?? "");
                      return (
                        <div key={tour.id} className="bg-white border rounded-xl overflow-hidden">
                          {/* Embed iframe */}
                          <div className="relative">
                            <iframe
                              src={embedUrl}
                              className="w-full aspect-video"
                              allowFullScreen
                              allow="xr-spatial-tracking; gyroscope; accelerometer"
                              title={tour.originalName}
                            />
                          </div>
                          {/* Footer */}
                          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{provider.icon}</span>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{tour.originalName}</p>
                                <p className="text-xs text-gray-400 truncate max-w-xs">{tour.cdnUrl}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a href={tour.cdnUrl ?? "#"} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="Open in new tab">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                              {canEdit && (
                                <button
                                  onClick={() => { if (confirm("Remove this tour?")) removeMutation.mutate({ mediaId: tour.id, galleryId }); }}
                                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Remove tour"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right panel — Settings (1 col) ── */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Stats</h3>
              <div className="space-y-2 text-sm">
                <StatRow label="Photos" value={photos.length} />
                <StatRow label="Videos" value={videos.length} />
                <StatRow label="Tours" value={tours.length} />
                <StatRow label="Floorplans" value={floorplans.length} />
                <div className="border-t pt-2 mt-2">
                  <StatRow label="Views" value={gallery.viewCount} />
                  <StatRow label="Downloads" value={gallery.downloadCount} />
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="bg-white border rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Settings</h3>

              <ToggleRow
                icon={gallery.isPublic ? <Globe className="h-4 w-4 text-green-500" /> : <Lock className="h-4 w-4 text-gray-400" />}
                label="Public access"
                checked={gallery.isPublic}
                disabled={isArchived}
                onChange={() => updateMutation.mutate({ id: galleryId, isPublic: !gallery.isPublic })}
              />
              <ToggleRow
                icon={<Download className="h-4 w-4 text-gray-400" />}
                label="Allow downloads"
                checked={gallery.downloadEnabled}
                disabled={isArchived}
                onChange={() => updateMutation.mutate({ id: galleryId, downloadEnabled: !gallery.downloadEnabled })}
              />

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Password (optional)</label>
                <input
                  type="text"
                  defaultValue={gallery.password ?? ""}
                  placeholder="Leave blank for no password"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onBlur={(e) => updateMutation.mutate({ id: galleryId, password: e.target.value.trim() || null })}
                  disabled={isArchived}
                />
              </div>
            </div>

            {/* Client */}
            <div className="bg-white border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Client</h3>
              <p className="text-sm text-gray-700">{gallery.job.client.firstName} {gallery.job.client.lastName}</p>
              <p className="text-xs text-gray-500">{gallery.job.client.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small shared sub-components ──────────────────────────────────────────

function EmptyState({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="bg-white border rounded-xl py-14 text-center">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-sm font-semibold text-gray-600">{label}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ToggleRow({
  icon, label, checked, disabled, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={cn("relative w-10 h-5 rounded-full transition-colors", checked ? "bg-blue-600" : "bg-gray-200")}
      >
        <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", checked ? "translate-x-5" : "")} />
      </button>
    </label>
  );
}

function UploadQueue({ uploads, onDismiss }: { uploads: UploadItem[]; onDismiss: (id: string) => void }) {
  if (uploads.length === 0) return null;
  return (
    <div className="space-y-2">
      {uploads.map((u) => (
        <div key={u.id} className="flex items-center gap-3 bg-white border rounded-lg px-4 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{u.file.name}</p>
            {u.status === "uploading" && (
              <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${u.progress}%` }} />
              </div>
            )}
            {u.status === "error" && <p className="text-xs text-red-500 mt-0.5">{u.error}</p>}
          </div>
          <span className={cn("text-xs shrink-0",
            u.status === "done" ? "text-green-600" :
            u.status === "error" ? "text-red-500" :
            u.status === "uploading" ? "text-blue-600" : "text-gray-400"
          )}>
            {u.status === "done" ? "✓ Done" : u.status === "error" ? "Failed" : u.status === "uploading" ? "Uploading…" : "Queued"}
          </span>
          {(u.status === "done" || u.status === "error") && (
            <button onClick={() => onDismiss(u.id)} className="text-gray-300 hover:text-gray-500">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

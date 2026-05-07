"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

type UploadItem = {
  id: string;
  file: File;
  preview: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

type UploadUrlResponse = {
  signedUrl: string;
  storageKey: string;
  cdnUrl: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  mediaType: "PHOTO" | "VIDEO" | "DRONE_PHOTO" | "DRONE_VIDEO" | "FLOOR_PLAN" | "VIRTUAL_TOUR";
};

export default function MobileUploadPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const { data: job, isLoading } = trpc.mobile.getJob.useQuery({ jobId }, { retry: false });
  const addMediaMutation = trpc.gallery.addMedia.useMutation();

  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      status: "queued",
      progress: 0,
    }));
    setItems((prev) => [...prev, ...newItems]);
    setAllDone(false);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function uploadFile(item: UploadItem, galleryId: string): Promise<void> {
    // Step 1: Get signed upload URL
    const urlResp = await fetch("/api/gallery/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        galleryId,
        fileName: item.file.name,
        mimeType: item.file.type || "image/jpeg",
        fileSize: item.file.size,
      }),
    });

    if (!urlResp.ok) {
      const err = await urlResp.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || "Failed to get upload URL");
    }

    const uploadData = await urlResp.json() as UploadUrlResponse;

    // Step 2: Upload directly to Supabase via XHR (for progress)
    await new Promise<void>((resolve, reject) => {
      const formBody = new FormData();
      formBody.append("cacheControl", "3600");
      formBody.append("", item.file);

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadData.signedUrl);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 90); // 90% for upload
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, progress: pct } : i))
          );
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      });

      xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
      xhr.send(formBody);
    });

    // Step 3: Register in DB
    await addMediaMutation.mutateAsync({
      galleryId,
      fileName: uploadData.fileName,
      originalName: uploadData.originalName,
      mimeType: uploadData.mimeType,
      fileSize: uploadData.fileSize,
      storageKey: uploadData.storageKey,
      cdnUrl: uploadData.cdnUrl,
      mediaType: uploadData.mediaType,
      isCover: false,
    });

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, progress: 100, status: "done" } : i))
    );
  }

  async function handleUploadAll() {
    if (!job?.gallery?.id) return;
    const galleryId = job.gallery.id;

    const queued = items.filter((i) => i.status === "queued" || i.status === "error");
    if (queued.length === 0) return;

    setUploading(true);

    for (const item of queued) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "uploading", progress: 0 } : i))
      );

      try {
        await uploadFile(item, galleryId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error", error: msg } : i))
        );
      }
    }

    setUploading(false);
    setAllDone(items.every((i) => i.status === "done"));
  }

  const queuedCount = items.filter((i) => i.status === "queued" || i.status === "error").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const hasGallery = !!job?.gallery?.id;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 active:bg-gray-700 shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold text-white">Upload Photos</h1>
            <p className="text-xs text-gray-500 truncate max-w-[220px]">{job?.propertyAddress}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* No gallery warning */}
        {!hasGallery && (
          <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-2xl p-4">
            <p className="text-yellow-300 font-semibold text-sm">No gallery set up yet</p>
            <p className="text-yellow-400/70 text-xs mt-1">
              A gallery needs to be created for this job before photos can be uploaded. Ask your admin to create one.
            </p>
          </div>
        )}

        {/* Pick buttons */}
        {hasGallery && (
          <div className="grid grid-cols-2 gap-3">
            {/* Camera */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-gray-900 border border-gray-800 active:bg-gray-800 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-blue-400">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                  <circle cx="12" cy="13" r="3"/>
                </svg>
              </div>
              <span className="text-white text-sm font-semibold">Camera</span>
              <span className="text-gray-500 text-xs">Take a photo</span>
            </button>

            {/* Library */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-gray-900 border border-gray-800 active:bg-gray-800 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-purple-600/20 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-purple-400">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <path d="m8 21 4-4 4 4"/>
                  <path d="M2 10h20"/>
                </svg>
              </div>
              <span className="text-white text-sm font-semibold">Library</span>
              <span className="text-gray-500 text-xs">Choose photos</span>
            </button>
          </div>
        )}

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {/* Queue */}
        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Queue · {items.length} {items.length === 1 ? "file" : "files"}
              </p>
              {doneCount > 0 && (
                <span className="text-xs text-green-400">{doneCount} uploaded</span>
              )}
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-3 flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-xl bg-gray-800 overflow-hidden shrink-0">
                    {item.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
                          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{item.file.name}</p>
                    <p className="text-gray-500 text-[10px]">
                      {(item.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>

                    {/* Progress bar */}
                    {item.status === "uploading" && (
                      <div className="mt-1.5 h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}

                    {item.status === "error" && (
                      <p className="text-red-400 text-[10px] mt-0.5">{item.error}</p>
                    )}
                  </div>

                  {/* Status icon / remove */}
                  <div className="shrink-0">
                    {item.status === "queued" && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 active:bg-gray-700"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    )}
                    {item.status === "uploading" && (
                      <div className="w-7 h-7 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                      </div>
                    )}
                    {item.status === "done" && (
                      <div className="w-7 h-7 rounded-full bg-green-900/40 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-400">
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                      </div>
                    )}
                    {item.status === "error" && (
                      <div className="w-7 h-7 rounded-full bg-red-900/40 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload button */}
        {hasGallery && queuedCount > 0 && (
          <button
            onClick={handleUploadAll}
            disabled={uploading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl font-semibold text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload {queuedCount} {queuedCount === 1 ? "Photo" : "Photos"}
              </>
            )}
          </button>
        )}

        {/* All done message */}
        {allDone && items.length > 0 && (
          <div className="text-center py-4">
            <p className="text-green-400 font-semibold">All files uploaded!</p>
            <button
              onClick={() => router.back()}
              className="mt-3 text-blue-400 text-sm font-medium"
            >
              Back to job
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

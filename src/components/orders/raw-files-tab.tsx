"use client";

import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Download, File, FileArchive, FileImage, FileVideo, Loader2, Trash2, UploadCloud } from "lucide-react";

/**
 * Raw files — capture files uploaded straight to the platform's private
 * storage (signed upload URLs, 2GB per file, any type). Google Drive /
 * Dropbox connections can layer on later without changing this surface.
 */

interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileIcon(mime: string, name: string) {
  const n = name.toLowerCase();
  if (mime.startsWith("image/") || /\.(raw|dng|cr2|cr3|nef|arw|orf|raf)$/.test(n)) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return FileArchive;
  return File;
}

export function RawFilesTab({ jobId }: { jobId: string }) {
  const utils = trpc.useUtils();
  const files = trpc.jobs.listRawFiles.useQuery({ jobId });
  const register = trpc.jobs.registerRawFile.useMutation({
    onSuccess: () => utils.jobs.listRawFiles.invalidate({ jobId }),
  });
  const remove = trpc.jobs.deleteRawFile.useMutation({
    onSuccess: () => utils.jobs.listRawFiles.invalidate({ jobId }),
  });

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: globalThis.File, itemId: string) => {
    const patch = (p: Partial<UploadItem>) =>
      setUploads((prev) => prev.map((u) => (u.id === itemId ? { ...u, ...p } : u)));
    try {
      const urlRes = await fetch("/api/raw/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, fileName: file.name, mimeType: file.type, fileSize: file.size }),
      });
      const urlData = await urlRes.json() as {
        signedUrl: string; storageKey: string; fileName: string; originalName: string;
        mimeType: string; fileSize: number; error?: string;
      };
      if (!urlRes.ok) throw new Error(urlData.error ?? "Could not get upload URL");
      patch({ progress: 10 });

      await new Promise<void>((resolve, reject) => {
        const formBody = new FormData();
        formBody.append("cacheControl", "3600");
        formBody.append("", file);
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) patch({ progress: Math.min(90, Math.round((e.loaded / e.total) * 80) + 10) });
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        });
        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.open("PUT", urlData.signedUrl);
        xhr.send(formBody);
      });

      patch({ progress: 95 });
      await register.mutateAsync({
        jobId,
        fileName: urlData.fileName,
        originalName: urlData.originalName,
        mimeType: urlData.mimeType,
        fileSize: urlData.fileSize,
        storageKey: urlData.storageKey,
      });
      patch({ status: "done", progress: 100 });
    } catch (err) {
      patch({ status: "error", error: err instanceof Error ? err.message : "Upload failed" });
    }
  }, [jobId, register]);

  const queue = useCallback((list: FileList | globalThis.File[]) => {
    const arr = Array.from(list);
    const items: UploadItem[] = arr.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: f.name,
      size: f.size,
      status: "uploading",
      progress: 0,
    }));
    setUploads((prev) => [...prev.filter((u) => u.status !== "done"), ...items]);
    arr.reduce(
      (chain, f, i) => chain.then(() => uploadFile(f, items[i].id)),
      Promise.resolve()
    );
  }, [uploadFile]);

  const rows = files.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) queue(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-blue-400 bg-blue-50/60" : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
        )}
      >
        <UploadCloud className={cn("mb-2 h-8 w-8", dragging ? "text-blue-500" : "text-gray-300")} />
        <p className="text-sm font-medium text-gray-700">Drop raw files here or click to browse</p>
        <p className="mt-1 text-xs text-gray-400">
          Any file type — RAW, DNG, video, ZIP — up to 2GB each. Stored securely on Scalist.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) queue(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* In-flight uploads */}
      {uploads.filter((u) => u.status !== "done").length > 0 && (
        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
          {uploads.filter((u) => u.status !== "done").map((u) => (
            <div key={u.id}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="truncate text-gray-700">{u.name}</span>
                <span className={cn("shrink-0", u.status === "error" ? "text-red-600" : "text-gray-400")}>
                  {u.status === "error" ? u.error : `${u.progress}%`}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn("h-full rounded-full transition-all", u.status === "error" ? "bg-red-400" : "bg-blue-500")}
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File list */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-gray-900">Raw files</h2>
          <span className="text-[11px] text-gray-400">
            {rows.length} file{rows.length !== 1 ? "s" : ""}
            {rows.length > 0 && ` · ${fmtSize(rows.reduce((s, f) => s + f.fileSize, 0))}`}
          </span>
        </div>
        {files.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-gray-400">
            Nothing uploaded yet. Photographers can drop capture files here right after the shoot.
          </p>
        ) : (
          <div>
            {rows.map((f) => {
              const Icon = fileIcon(f.mimeType, f.originalName);
              return (
                <div key={f.id} className="group flex items-center gap-3 border-b border-gray-50 px-4 py-2.5 last:border-0">
                  <Icon className="h-4 w-4 shrink-0 text-gray-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-gray-800">{f.originalName}</p>
                    <p className="text-[11px] text-gray-400">
                      {fmtSize(f.fileSize)}
                      {f.uploadedBy && ` · ${f.uploadedBy.fullName}`}
                      {` · ${format(new Date(f.createdAt), "MMM d, h:mm a")}`}
                    </p>
                  </div>
                  {f.downloadUrl && (
                    <a
                      href={f.downloadUrl}
                      className="rounded p-1.5 text-gray-300 transition-colors hover:text-blue-600"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={() => remove.mutate({ fileId: f.id })}
                    disabled={remove.isPending}
                    className="rounded p-1.5 text-gray-200 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, ImageIcon, Loader2, Trash2, X } from "lucide-react";

/**
 * Pro photo management for the listing:
 *  - click a photo → fullscreen carousel (arrow keys / buttons, Esc closes)
 *  - drag to reorder (persisted; the cover is always the first photo)
 *  - multi-select: Cmd/Ctrl-click toggles, Shift-click selects a range,
 *    hover checkbox; Delete removes the selection, Esc clears it
 */

export interface GridPhoto {
  id: string;
  cdnUrl: string | null;
  originalName: string;
  isCover: boolean;
}

export function PhotoGrid({
  galleryId,
  photos,
  canEdit,
}: {
  galleryId: string;
  photos: GridPhoto[];
  canEdit: boolean;
}) {
  const utils = trpc.useUtils();
  const [order, setOrder] = useState<string[]>(() => photos.map((p) => p.id));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastPicked, setLastPicked] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep local order in sync when the server list changes (uploads/removals)
  const serverKey = photos.map((p) => p.id).join("|");
  useEffect(() => {
    setOrder(photos.map((p) => p.id));
    setSelected((prev) => {
      const ids = new Set(photos.map((p) => p.id));
      const next = new Set(Array.from(prev).filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const ordered = order.map((id) => byId.get(id)).filter((p): p is GridPhoto => !!p);

  const reorder = trpc.gallery.reorderMedia.useMutation({
    onSuccess: () => utils.gallery.getById.invalidate({ id: galleryId }),
  });
  const remove = trpc.gallery.removeMedia.useMutation({
    onSuccess: () => utils.gallery.getById.invalidate({ id: galleryId }),
  });

  const toggleSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastPicked) {
        const a = order.indexOf(lastPicked);
        const b = order.indexOf(id);
        if (a !== -1 && b !== -1) {
          for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(order[i]);
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastPicked(id);
  }, [lastPicked, order]);

  const deleteSelected = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Remove ${selected.size} photo${selected.size !== 1 ? "s" : ""} from the listing?`)) return;
    for (const id of Array.from(selected)) {
      await remove.mutateAsync({ mediaId: id, galleryId });
    }
    setSelected(new Set());
  }, [selected, remove, galleryId]);

  // Grid-level keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (lightbox != null) return; // lightbox has its own keys
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if ((e.key === "Delete" || e.key === "Backspace") && canEdit && selected.size > 0) {
        e.preventDefault();
        void deleteSelected();
      } else if (e.key === "Escape" && selected.size > 0) {
        setSelected(new Set());
      } else if ((e.metaKey || e.ctrlKey) && e.key === "a" && ordered.length > 0 && containerRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        setSelected(new Set(order));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, selected, canEdit, deleteSelected, order, ordered.length]);

  const commitOrder = (next: string[]) => {
    setOrder(next);
    reorder.mutate({ galleryId, orderedIds: next });
  };

  if (ordered.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <ImageIcon className="mb-2 h-10 w-10 text-gray-200" />
        <p className="text-sm font-medium text-gray-500">No photos yet</p>
        <p className="mt-1 text-xs text-gray-400">Upload photos above to get started.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} tabIndex={-1} className="outline-none">
      {/* Selection toolbar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2">
          <span className="text-[13px] font-medium text-blue-800">{selected.size} selected</span>
          {canEdit && (
            <button
              onClick={() => void deleteSelected()}
              disabled={remove.isPending}
              className="flex items-center gap-1 text-[12px] font-medium text-red-600 transition-colors hover:text-red-700"
            >
              {remove.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Remove
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[12px] text-gray-500 hover:text-gray-700">
            Clear (Esc)
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {ordered.map((photo, idx) => {
          const isSelected = selected.has(photo.id);
          return (
            <div
              key={photo.id}
              draggable={canEdit}
              onDragStart={() => { dragFrom.current = idx; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragFrom.current;
                dragFrom.current = null;
                if (from == null || from === idx) return;
                const next = [...order];
                const [moved] = next.splice(from, 1);
                next.splice(idx, 0, moved);
                commitOrder(next);
              }}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) {
                  toggleSelect(photo.id, e.shiftKey);
                } else if (selected.size > 0) {
                  toggleSelect(photo.id, false);
                } else {
                  setLightbox(idx);
                }
              }}
              className={cn(
                "group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-xl bg-gray-100 transition-shadow",
                isSelected && "ring-2 ring-blue-500 ring-offset-2",
                canEdit && "active:cursor-grabbing"
              )}
            >
              {photo.cdnUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.cdnUrl} alt={photo.originalName} draggable={false} className="h-full w-full select-none object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No preview</div>
              )}

              {idx === 0 && (
                <span className="absolute left-2 top-2 rounded bg-yellow-400 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-900">
                  Cover
                </span>
              )}

              {/* Select checkbox */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id, e.shiftKey); }}
                aria-label={isSelected ? "Deselect" : "Select"}
                className={cn(
                  "absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border transition-all",
                  isSelected
                    ? "border-blue-600 bg-blue-600 text-white opacity-100"
                    : "border-white/80 bg-black/30 text-transparent opacity-0 hover:text-white group-hover:opacity-100"
                )}
              >
                <Check className="h-3 w-3" />
              </button>

              {canEdit && selected.size === 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Remove this photo?")) remove.mutate({ mediaId: photo.id, galleryId });
                  }}
                  title="Remove photo"
                  className="absolute bottom-2 right-2 rounded-lg bg-black/50 p-1.5 text-white opacity-0 transition-all hover:bg-red-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-gray-400">
        Click to view · drag to reorder (first photo is the cover) · Cmd/Ctrl-click to select · Shift-click for a range · Delete removes the selection
      </p>

      {lightbox != null && (
        <Lightbox
          photos={ordered}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: GridPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const prev = useCallback(() => onIndex((index - 1 + photos.length) % photos.length), [index, photos.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % photos.length), [index, photos.length, onIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  const photo = photos[index];
  if (!photo || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 text-white/80">
        <p className="truncate text-sm">{photo.originalName}</p>
        <div className="flex items-center gap-4">
          <span className="text-xs tabular-nums">{index + 1} / {photos.length}</span>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 transition-colors hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-6" onClick={(e) => e.stopPropagation()}>
        {photo.cdnUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.cdnUrl} alt={photo.originalName} className="max-h-full max-w-full select-none rounded-lg object-contain" />
        )}
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5 overflow-x-auto px-5 pb-4" onClick={(e) => e.stopPropagation()}>
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onIndex(i)}
              className={cn(
                "h-12 w-16 shrink-0 overflow-hidden rounded-md transition-all",
                i === index ? "ring-2 ring-white" : "opacity-50 hover:opacity-90"
              )}
            >
              {p.cdnUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cdnUrl} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

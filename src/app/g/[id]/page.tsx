"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { format } from "date-fns";

// ─── Password Gate ────────────────────────────────────────────────────────────

function PasswordGate({ onSubmit, error }: { onSubmit: (pw: string) => void; error?: string }) {
  const [pw, setPw] = useState("");
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-xl font-semibold text-white mb-2">Password Required</h1>
        <p className="text-sm text-gray-400 mb-6">
          This gallery is password-protected. Enter the password to view your photos.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(pw);
          }}
          className="space-y-3"
        >
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Enter password"
            autoFocus
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            View Gallery
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

interface MediaItem {
  id: string;
  cdnUrl: string | null;
  originalName: string;
  width: number | null;
  height: number | null;
  mediaType: string;
  isCover: boolean;
  fileSize: number;
  mimeType: string;
}

function Lightbox({
  media,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  media: MediaItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const item = media[index];
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/60 text-sm">
          {index + 1} / {media.length}
        </span>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white text-2xl leading-none transition-colors"
        >
          ×
        </button>
      </div>

      {/* Image */}
      <div
        className="flex-1 flex items-center justify-center px-16 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev */}
        {index > 0 && (
          <button
            onClick={onPrev}
            className="absolute left-4 text-white/60 hover:text-white text-4xl px-2 transition-colors z-10"
          >
            ‹
          </button>
        )}

        {item.cdnUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.cdnUrl}
            alt={item.originalName}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />
        )}

        {/* Next */}
        {index < media.length - 1 && (
          <button
            onClick={onNext}
            className="absolute right-4 text-white/60 hover:text-white text-4xl px-2 transition-colors z-10"
          >
            ›
          </button>
        )}
      </div>

      {/* Bottom caption */}
      <div
        className="px-6 py-4 shrink-0 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white/40 text-xs">{item.originalName}</p>
      </div>
    </div>
  );
}

// ─── Gallery View ─────────────────────────────────────────────────────────────

function GalleryView({
  gallery,
}: {
  gallery: {
    id: string;
    name: string;
    slug: string;
    downloadEnabled: boolean;
    mediaCount: number;
    viewCount: number;
    expiresAt: Date | null;
    propertyAddress: string;
    propertyCity: string;
    propertyState: string;
    workspace: { name: string; logoUrl: string | null; brandColor: string };
    media: MediaItem[];
  };
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const brandColor = gallery.workspace.brandColor ?? "#1B4F9E";

  const photos = gallery.media;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {gallery.workspace.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gallery.workspace.logoUrl}
                alt={gallery.workspace.name}
                className="h-7 w-auto"
              />
            )}
            <div>
              <p className="text-xs text-gray-500">{gallery.workspace.name}</p>
              <h1 className="font-semibold text-white text-sm">{gallery.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>{gallery.mediaCount} photos</span>
            {gallery.expiresAt && (
              <span>Expires {format(new Date(gallery.expiresAt), "MMM d, yyyy")}</span>
            )}
            {gallery.downloadEnabled && (
              <a
                href={`/api/gallery/download/${gallery.slug}`}
                style={{ backgroundColor: brandColor }}
                className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                ↓ Download All
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Address banner */}
      <div className="border-b border-gray-800 px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-400 text-sm">
            📍 {gallery.propertyAddress}, {gallery.propertyCity}, {gallery.propertyState}
          </p>
        </div>
      </div>

      {/* Photo grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {photos.length === 0 ? (
          <div className="text-center py-20 text-gray-600">No photos available yet.</div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 space-y-2">
            {photos.map((photo, i) => (
              <div
                key={photo.id}
                className="break-inside-avoid cursor-pointer overflow-hidden rounded-lg group relative"
                onClick={() => setLightboxIndex(i)}
              >
                {photo.cdnUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.cdnUrl}
                    alt={photo.originalName}
                    className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-800 flex items-center justify-center text-gray-600 text-xs">
                    No preview
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                  <span className="text-white/0 group-hover:text-white/80 transition-colors text-2xl">⤢</span>
                </div>
                {photo.isCover && (
                  <span className="absolute top-2 left-2 text-[10px] bg-white/20 backdrop-blur text-white px-1.5 py-0.5 rounded font-medium">
                    Cover
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-4 text-center">
        <p className="text-gray-600 text-xs">Powered by FocalOS</p>
      </footer>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          media={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() =>
            setLightboxIndex((i) => Math.min(photos.length - 1, (i ?? 0) + 1))
          }
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const params = useParams();
  const slug = params?.id as string;
  const [password, setPassword] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const { data, isLoading, isError, error } = trpc.gallery.getPublic.useQuery(
    { slug, password },
    { enabled: !!slug, retry: false }
  );

  const handlePasswordSubmit = (pw: string) => {
    setPasswordError(undefined);
    setPassword(pw);
  };

  // Catch wrong password error after requery
  if (
    isError &&
    (error as { message?: string })?.message === "Incorrect password."
  ) {
    if (!passwordError) setPasswordError("Incorrect password. Try again.");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError) {
    const msg = (error as { message?: string })?.message ?? "";
    if (msg === "Incorrect password.") {
      return <PasswordGate onSubmit={handlePasswordSubmit} error={passwordError} />;
    }
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="text-5xl">📷</div>
        <h1 className="text-2xl font-bold text-white">Gallery unavailable</h1>
        <p className="text-gray-400 text-sm max-w-sm">{msg || "This gallery doesn't exist or has been removed."}</p>
      </div>
    );
  }

  if (!data) return null;

  if (data.requiresPassword) {
    return <PasswordGate onSubmit={handlePasswordSubmit} error={passwordError} />;
  }

  if (!data.gallery) return null;

  return <GalleryView gallery={data.gallery as Parameters<typeof GalleryView>[0]["gallery"]} />;
}

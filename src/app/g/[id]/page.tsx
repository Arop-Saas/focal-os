"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
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

// ─── Payment Banner (sticky bottom CTA when invoice is unpaid) ────────────────

function PaymentBanner({
  slug,
  amountDue,
  mediaCount,
  brandColor,
  workspaceName,
  hasStripe,
}: {
  slug: string;
  amountDue: number;
  mediaCount: number;
  brandColor: string;
  workspaceName: string;
  hasStripe: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const formatted = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amountDue);

  return (
    <div className="fixed bottom-0 inset-x-0 z-40">
      {/* Expanded detail panel */}
      {expanded && (
        <div className="bg-gray-900/98 backdrop-blur-md border-t border-gray-700 px-4 pt-5 pb-3 max-w-lg mx-auto rounded-t-2xl shadow-2xl">
          <div className="text-center mb-4">
            <p className="text-white font-semibold text-base">Ready to download?</p>
            <p className="text-gray-400 text-sm mt-1">
              Purchase to unlock and download all {mediaCount} photos.
            </p>
          </div>
          <div
            className="rounded-xl px-4 py-3 mb-4 text-center"
            style={{ backgroundColor: `${brandColor}20`, border: `1px solid ${brandColor}40` }}
          >
            <p className="text-xs text-gray-400 mb-0.5">Amount due</p>
            <p className="text-3xl font-bold text-white">{formatted}</p>
          </div>
          {hasStripe ? (
            <button
              onClick={handlePay}
              disabled={loading}
              style={{ backgroundColor: brandColor }}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 mb-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  Redirecting to payment…
                </>
              ) : (
                <>💳 Pay {formatted} to Download</>
              )}
            </button>
          ) : (
            <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400 text-center mb-2">
              Contact <span className="text-white font-medium">{workspaceName}</span> to arrange payment and receive your download link.
            </div>
          )}
          {error && <p className="text-red-400 text-xs text-center mb-2">{error}</p>}
          <p className="text-xs text-gray-600 text-center">Secured by Stripe · Visa, Mastercard, Amex & debit accepted</p>
          <button onClick={() => setExpanded(false)} className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Close
          </button>
        </div>
      )}

      {/* Collapsed sticky bar */}
      {!expanded && (
        <div
          className="border-t border-gray-800 bg-gray-950/95 backdrop-blur-md px-4 py-3"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-white text-sm font-semibold">{mediaCount} photos ready</p>
              <p className="text-gray-400 text-xs">Purchase to unlock downloads</p>
            </div>
            <button
              onClick={() => setExpanded(true)}
              style={{ backgroundColor: brandColor }}
              className="shrink-0 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 flex items-center gap-2"
            >
              💳 Buy & Download · {formatted}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Download helper ──────────────────────────────────────────────────────────

async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  media,
  index,
  downloadEnabled,
  onClose,
  onPrev,
  onNext,
}: {
  media: MediaItem[];
  index: number;
  downloadEnabled: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const item = media[index];
  if (!item) return null;

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPrev, onNext, onClose]);

  const isVideo = item.mediaType === "VIDEO" || item.mediaType === "DRONE_VIDEO";

  return (
    <div className="fixed inset-0 z-50 bg-black/97 flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <span className="text-white/50 text-sm font-medium">{index + 1} / {media.length}</span>
        <div className="flex items-center gap-3">
          {downloadEnabled && item.cdnUrl && (
            <button
              onClick={() => downloadFile(item.cdnUrl!, item.originalName)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
            >
              ↓ Download
            </button>
          )}
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10">×</button>
        </div>
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center px-14 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {index > 0 && (
          <button onClick={onPrev} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-5xl px-2 transition-colors z-10 h-16 flex items-center">‹</button>
        )}

        {item.cdnUrl && (
          isVideo ? (
            <video src={item.cdnUrl} controls autoPlay className="max-w-full max-h-full rounded-lg" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.cdnUrl} alt={item.originalName} className="max-w-full max-h-full object-contain select-none rounded" draggable={false} />
          )
        )}

        {index < media.length - 1 && (
          <button onClick={onNext} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-5xl px-2 transition-colors z-10 h-16 flex items-center">›</button>
        )}
      </div>

      {/* Caption */}
      <div className="px-6 py-3 shrink-0 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-white/30 text-xs">{item.originalName}</p>
      </div>
    </div>
  );
}

// ─── Gallery View ─────────────────────────────────────────────────────────────

function GalleryView({
  gallery,
  paymentInfo,
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
  paymentInfo?: { amountDue: number; hasStripe: boolean; slug: string } | null;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"photos" | "videos" | "floorplans">("photos");
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);
  const brandColor = gallery.workspace.brandColor ?? "#1B4F9E";

  // Downloads are disabled until payment is complete
  const canDownload = gallery.downloadEnabled && !paymentInfo;

  const photos     = gallery.media.filter((m) => m.mediaType === "PHOTO");
  const videos     = gallery.media.filter((m) => m.mediaType === "VIDEO" || m.mediaType === "DRONE_VIDEO");
  const floorplans = gallery.media.filter((m) => m.mediaType === "FLOOR_PLAN");
  const activeMedia = activeTab === "photos" ? photos : activeTab === "videos" ? videos : floorplans;

  // Find lightbox index within activeMedia
  const handleDownloadAll = useCallback(async () => {
    if (downloading) return;
    const downloadable = activeMedia.filter((m) => m.cdnUrl);
    if (downloadable.length === 0) return;
    setDownloading(true);
    setDownloadProgress({ done: 0, total: downloadable.length });
    for (let i = 0; i < downloadable.length; i++) {
      const item = downloadable[i];
      if (item.cdnUrl) {
        await downloadFile(item.cdnUrl, item.originalName);
        setDownloadProgress({ done: i + 1, total: downloadable.length });
        // Small delay to avoid browser blocking multiple downloads
        if (i < downloadable.length - 1) await new Promise((r) => setTimeout(r, 400));
      }
    }
    setDownloading(false);
    setDownloadProgress(null);
  }, [downloading, activeMedia]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="px-6 pt-6 pb-5">
        <div className="max-w-7xl mx-auto">
          {/* Top row: branding + actions */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            {/* Logo + name */}
            <div className="flex items-center gap-4">
              {gallery.workspace.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={gallery.workspace.logoUrl}
                  alt={gallery.workspace.name}
                  className="h-12 w-auto rounded-xl shadow-lg ring-1 ring-white/10"
                />
              ) : (
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg ring-1 ring-white/10"
                  style={{ backgroundColor: brandColor }}
                >
                  {gallery.workspace.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-widest mb-0.5"
                  style={{ color: brandColor }}
                >
                  {gallery.workspace.name}
                </p>
                <h1 className="text-xl font-black text-white tracking-tight leading-tight">
                  {gallery.name}
                </h1>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {gallery.expiresAt && (
                <span className="bg-gray-800 border border-gray-700 text-gray-400 text-xs font-medium px-3 py-1.5 rounded-xl">
                  Expires {format(new Date(gallery.expiresAt), "MMM d, yyyy")}
                </span>
              )}
              {canDownload && (
                <button
                  onClick={handleDownloadAll}
                  disabled={downloading}
                  style={{ backgroundColor: brandColor }}
                  className="px-4 py-2 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2 shadow-lg"
                >
                  {downloading && downloadProgress ? (
                    <>
                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                      {downloadProgress.done}/{downloadProgress.total}
                    </>
                  ) : (
                    <>↓ Download All ({activeMedia.length})</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Address badge */}
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-2 bg-gray-800/80 border border-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-xl">
              <span className="text-base">📍</span>
              {gallery.propertyAddress}, {gallery.propertyCity}, {gallery.propertyState}
            </span>
          </div>

          {/* Tab pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {(
              [
                { key: "photos" as const, label: "Photos", count: photos.length, always: true },
                { key: "videos" as const, label: "Videos", count: videos.length, always: false },
                { key: "floorplans" as const, label: "Floorplans", count: floorplans.length, always: true },
              ] as { key: "photos" | "videos" | "floorplans"; label: string; count: number; always: boolean }[]
            )
              .filter((t) => t.always || t.count > 0)
              .map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={isActive ? { backgroundColor: brandColor } : {}}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                      isActive
                        ? "text-white shadow-lg scale-105"
                        : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          isActive ? "bg-white/20 text-white" : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      </header>

      {/* Divider */}
      <div className="border-t border-gray-800 mb-2" />

      {/* Media grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeMedia.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            {activeTab === "photos" ? "No photos available yet." : activeTab === "videos" ? "No videos available yet." : "No floor plans available yet."}
          </div>
        ) : activeTab === "photos" ? (
          /* Photo masonry grid */
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
                  <div className="w-full h-40 bg-gray-800 flex items-center justify-center text-gray-600 text-xs">No preview</div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-200 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100">
                  {canDownload && photo.cdnUrl && (
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadFile(photo.cdnUrl!, photo.originalName); }}
                      className="bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1 rounded-lg font-medium backdrop-blur-sm transition-colors"
                    >
                      ↓
                    </button>
                  )}
                </div>
                {photo.isCover && (
                  <span className="absolute top-2 left-2 text-[10px] bg-white/20 backdrop-blur text-white px-1.5 py-0.5 rounded font-medium">Cover</span>
                )}
              </div>
            ))}
          </div>
        ) : activeTab === "videos" ? (
          /* Video grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <div key={video.id} className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
                {video.cdnUrl ? (
                  <video src={video.cdnUrl} controls className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-gray-800 flex items-center justify-center text-gray-600 text-sm">No preview</div>
                )}
                <div className="px-3 py-2.5 flex items-center justify-between">
                  <p className="text-xs text-gray-400 truncate">{video.originalName}</p>
                  {canDownload && video.cdnUrl && (
                    <button
                      onClick={() => downloadFile(video.cdnUrl!, video.originalName)}
                      className="ml-2 shrink-0 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      ↓ Save
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Floorplan grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {floorplans.map((fp, i) => (
              <div
                key={fp.id}
                className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 cursor-pointer group"
                onClick={() => setLightboxIndex(i)}
              >
                {fp.cdnUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fp.cdnUrl}
                    alt={fp.originalName}
                    className="w-full object-contain max-h-80 group-hover:opacity-90 transition-opacity"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-800 flex items-center justify-center text-gray-600 text-sm">No preview</div>
                )}
                <div className="px-3 py-2.5 flex items-center justify-between border-t border-gray-800">
                  <p className="text-xs text-gray-400 truncate">{fp.originalName}</p>
                  {canDownload && fp.cdnUrl && (
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadFile(fp.cdnUrl!, fp.originalName); }}
                      className="ml-2 shrink-0 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      ↓ Save
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer — extra bottom padding when payment banner is visible */}
      <footer className={`border-t border-gray-800 px-6 py-4 text-center mt-4 ${paymentInfo ? "pb-24" : ""}`}>
        <p className="text-gray-600 text-xs">Powered by FocalOS</p>
      </footer>

      {/* Payment banner */}
      {paymentInfo && (
        <PaymentBanner
          slug={paymentInfo.slug}
          amountDue={paymentInfo.amountDue}
          mediaCount={gallery.mediaCount}
          brandColor={brandColor}
          workspaceName={gallery.workspace.name}
          hasStripe={paymentInfo.hasStripe}
        />
      )}

      {/* Lightbox — for photos and floorplans */}
      {lightboxIndex !== null && (activeTab === "photos" || activeTab === "floorplans") && (
        <Lightbox
          media={activeTab === "photos" ? photos : floorplans}
          index={lightboxIndex}
          downloadEnabled={canDownload}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(activeMedia.length - 1, (i ?? 0) + 1))}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.id as string;
  const [password, setPassword] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [justPaid, setJustPaid] = useState(false);

  // Detect ?paid=1 redirect from Stripe success — show a brief success flash
  useEffect(() => {
    if (searchParams?.get("paid") === "1") {
      setJustPaid(true);
    }
  }, [searchParams]);

  const { data, isLoading, isError, error } = trpc.gallery.getPublic.useQuery(
    { slug, password },
    { enabled: !!slug, retry: false }
  );

  const handlePasswordSubmit = (pw: string) => {
    setPasswordError(undefined);
    setPassword(pw);
  };

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

  const paymentInfo =
    data.requiresPayment && data.paymentInfo
      ? { slug, amountDue: data.paymentInfo.amountDue, hasStripe: data.paymentInfo.hasStripe }
      : null;

  return (
    <>
      {/* Payment success toast */}
      {justPaid && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 animate-fade-in">
          ✅ Payment confirmed — your photos are ready to download!
        </div>
      )}
      <GalleryView
        gallery={data.gallery as Parameters<typeof GalleryView>[0]["gallery"]}
        paymentInfo={paymentInfo}
      />
    </>
  );
}

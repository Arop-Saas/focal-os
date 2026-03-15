"use client";

import { useState, useEffect } from "react";
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

// ─── Payment Gate ─────────────────────────────────────────────────────────────

function PaymentGate({
  slug,
  galleryName,
  propertyAddress,
  amountDue,
  mediaCount,
  brandColor,
  workspaceName,
  previewMedia,
  hasStripe,
}: {
  slug: string;
  galleryName: string;
  propertyAddress: string;
  amountDue: number;
  mediaCount: number;
  brandColor: string;
  workspaceName: string;
  previewMedia: Array<{ id: string; cdnUrl: string | null; originalName: string }>;
  hasStripe: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500">{workspaceName}</p>
            <h1 className="font-semibold text-white text-sm">{galleryName}</h1>
          </div>
          <span className="text-xs text-gray-500">{mediaCount} photos</span>
        </div>
      </header>

      {/* Address */}
      <div className="border-b border-gray-800 px-6 py-3">
        <p className="text-gray-400 text-sm max-w-7xl mx-auto">📍 {propertyAddress}</p>
      </div>

      {/* Blurred preview grid with overlay */}
      <div className="relative max-w-7xl mx-auto px-4 py-6">
        {/* Blurred photo grid */}
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 space-y-2 select-none pointer-events-none">
          {previewMedia.slice(0, 12).map((photo) => (
            <div key={photo.id} className="break-inside-avoid overflow-hidden rounded-lg">
              {photo.cdnUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.cdnUrl}
                  alt=""
                  className="w-full object-cover"
                  style={{ filter: "blur(18px)", transform: "scale(1.05)" }}
                  draggable={false}
                />
              ) : (
                <div className="w-full h-40 bg-gray-800" />
              )}
            </div>
          ))}
          {/* Fill remaining slots with dark tiles if fewer than 12 photos */}
          {Array.from({ length: Math.max(0, 8 - previewMedia.slice(0, 12).length) }).map((_, i) => (
            <div key={`placeholder-${i}`} className="break-inside-avoid overflow-hidden rounded-lg">
              <div className="w-full h-40 bg-gray-800/60" />
            </div>
          ))}
        </div>

        {/* Payment overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl mx-4">
            <div className="text-5xl mb-4">🔐</div>
            <h2 className="text-xl font-bold text-white mb-1">Your photos are ready</h2>
            <p className="text-gray-400 text-sm mb-5">
              Complete your payment to unlock and download all {mediaCount} photos.
            </p>

            {/* Amount */}
            <div
              className="rounded-xl px-4 py-3 mb-5 text-center"
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
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    Redirecting to payment…
                  </>
                ) : (
                  <>💳 Pay {formatted} to Unlock</>
                )}
              </button>
            ) : (
              <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">
                Contact <span className="text-white font-medium">{workspaceName}</span> to arrange payment and receive access to your photos.
              </div>
            )}

            {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

            <p className="text-xs text-gray-600 mt-4">
              Secured by Stripe · Visa, Mastercard, Amex & debit accepted
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-800 px-6 py-4 text-center mt-8">
        <p className="text-gray-600 text-xs">Powered by FocalOS</p>
      </footer>
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

  // Show payment gate if invoice is unpaid
  if (data.requiresPayment && data.paymentInfo) {
    return (
      <PaymentGate
        slug={slug}
        galleryName={data.gallery.name}
        propertyAddress={`${data.gallery.propertyAddress}, ${data.gallery.propertyCity}, ${data.gallery.propertyState}`}
        amountDue={data.paymentInfo.amountDue}
        mediaCount={data.gallery.mediaCount}
        brandColor={data.gallery.workspace.brandColor ?? "#1B4F9E"}
        workspaceName={data.gallery.workspace.name}
        previewMedia={data.gallery.media}
        hasStripe={data.paymentInfo.hasStripe}
      />
    );
  }

  return (
    <>
      {/* Payment success toast */}
      {justPaid && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 animate-fade-in">
          ✅ Payment confirmed — enjoy your photos!
        </div>
      )}
      <GalleryView gallery={data.gallery as Parameters<typeof GalleryView>[0]["gallery"]} />
    </>
  );
}

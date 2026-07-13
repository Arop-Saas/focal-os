/**
 * GET /api/gallery/download?slug=&id=&pw= — SERVER-ENFORCED download gate.
 *
 * The paywall used to live only in the UI (research risk R5/C5): anyone
 * with the public CDN URL could download unpaid, password-less. Now every
 * download re-checks, server-side:
 *   1. gallery is public + not expired/archived
 *   2. password (hashed) when set
 *   3. downloads enabled by the studio
 *   4. PAYMENT: invoice must be PAID when one exists
 * and only then mints a 60-second signed URL (attachment disposition).
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyGalleryPassword,
  mediaDownloadUrl,
} from "@/lib/gallery-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const mediaId = req.nextUrl.searchParams.get("id");
  const pw = req.nextUrl.searchParams.get("pw") ?? "";

  if (!slug || !mediaId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    select: {
      id: true,
      isPublic: true,
      status: true,
      expiresAt: true,
      password: true,
      passwordHash: true,
      downloadEnabled: true,
      job: { select: { invoice: { select: { status: true } } } },
      media: {
        where: { id: mediaId },
        select: { id: true, storageKey: true, cdnUrl: true, originalName: true },
      },
    },
  });

  if (!gallery || !gallery.isPublic || gallery.status === "ARCHIVED" || gallery.status === "EXPIRED") {
    return NextResponse.json({ error: "Gallery not available" }, { status: 404 });
  }
  if (gallery.expiresAt && new Date() > gallery.expiresAt) {
    return NextResponse.json({ error: "Gallery expired" }, { status: 403 });
  }

  // Password gate (hash first, legacy plaintext fallback)
  if (gallery.passwordHash) {
    if (!pw || !verifyGalleryPassword(pw, gallery.passwordHash)) {
      return NextResponse.json({ error: "Password required" }, { status: 403 });
    }
  } else if (gallery.password) {
    if (pw !== gallery.password) {
      return NextResponse.json({ error: "Password required" }, { status: 403 });
    }
  }

  if (!gallery.downloadEnabled) {
    return NextResponse.json({ error: "Downloads are disabled for this gallery" }, { status: 403 });
  }

  // THE paywall — server-side, non-negotiable
  const invoice = gallery.job?.invoice;
  if (invoice && invoice.status !== "PAID") {
    return NextResponse.json({ error: "Payment required to download" }, { status: 402 });
  }

  const media = gallery.media[0];
  if (!media) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  const url = await mediaDownloadUrl(media, media.originalName);
  if (!url) return NextResponse.json({ error: "Could not generate download" }, { status: 500 });

  // Count the download (fire-and-forget)
  void prisma.gallery.update({
    where: { id: gallery.id },
    data: { downloadCount: { increment: 1 } },
  }).catch(() => {});

  return NextResponse.json({ url, filename: media.originalName });
}

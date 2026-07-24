import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ensurePrivateBucket, PRIVATE_MEDIA_BUCKET } from "@/lib/gallery-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/tiff",
]);

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
]);

const MAX_IMAGE_SIZE = 25 * 1024 * 1024;   // 25 MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;  // 500 MB

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get workspace
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: { workspaces: { include: { workspace: true }, take: 1 } },
    });
    if (!user?.workspaces[0]) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 });
    }
    const workspaceId = user.workspaces[0].workspace.id;

    // Parse request body
    const body = await req.json() as { galleryId: string; fileName: string; mimeType: string; fileSize: number; mediaTypeHint?: string };
    const { galleryId, fileName, mimeType, fileSize, mediaTypeHint } = body;

    if (!galleryId || !fileName || !mimeType) {
      return NextResponse.json({ error: "galleryId, fileName, and mimeType are required" }, { status: 400 });
    }

    // Validate file type. The "Other" section (DOCUMENT) accepts any file.
    const isDocument = mediaTypeHint === "DOCUMENT";
    const isImage = IMAGE_TYPES.has(mimeType);
    const isVideo = VIDEO_TYPES.has(mimeType);
    if (!isDocument && !isImage && !isVideo) {
      return NextResponse.json(
        { error: `File type not allowed: ${mimeType}` },
        { status: 400 }
      );
    }

    // Validate file size
    const maxSize = isDocument || isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (fileSize > maxSize) {
      const limitLabel = isDocument || isVideo ? "500MB" : "25MB";
      return NextResponse.json(
        { error: `File too large. Maximum size is ${limitLabel}.` },
        { status: 400 }
      );
    }

    // Validate gallery belongs to workspace
    const gallery = await prisma.gallery.findFirst({
      where: { id: galleryId, workspaceId },
    });
    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    // Build storage path
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storageKey = `galleries/${workspaceId}/${galleryId}/${safeName}`;

    // Create signed upload URL via admin client (service role bypasses RLS)
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // S4: gallery media lives in the PRIVATE bucket — viewing/downloading
    // happens through short-lived signed URLs, never public links.
    await ensurePrivateBucket();
    const { data, error } = await adminClient.storage
      .from(PRIVATE_MEDIA_BUCKET)
      .createSignedUploadUrl(storageKey);

    if (error || !data) {
      console.error("Signed URL error:", error);
      return NextResponse.json({ error: "Could not create upload URL" }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storageKey,
      cdnUrl: null, // private bucket — no public URL exists (by design)
      fileName: safeName,
      originalName: fileName,
      mimeType,
      fileSize,
      mediaType: isDocument ? "DOCUMENT" : isVideo ? "VIDEO" : mediaTypeHint === "FLOOR_PLAN" ? "FLOOR_PLAN" : "PHOTO",
    });
  } catch (err) {
    console.error("Upload URL route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

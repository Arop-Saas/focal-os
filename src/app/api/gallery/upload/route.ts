import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Max file size: 25MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/tiff",
]);

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

    // Parse multipart form
    const formData = await req.formData();
    const galleryId = formData.get("galleryId") as string;
    const file = formData.get("file") as File;

    if (!galleryId || !file) {
      return NextResponse.json({ error: "galleryId and file are required" }, { status: 400 });
    }

    // Validate gallery belongs to workspace
    const gallery = await prisma.gallery.findFirst({
      where: { id: galleryId, workspaceId },
    });
    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}. Use JPEG, PNG, WebP, HEIC, or TIFF.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 25MB.` },
        { status: 400 }
      );
    }

    // Build storage path
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storageKey = `galleries/${workspaceId}/${galleryId}/${safeName}`;

    // Upload to Supabase Storage using service role (bypass RLS)
    const { createClient: createAdminSupabase } = await import("@supabase/supabase-js");
    const adminClient = createAdminSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from("galleries")
      .upload(storageKey, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = adminClient.storage
      .from("galleries")
      .getPublicUrl(storageKey);

    return NextResponse.json({
      storageKey,
      cdnUrl: publicUrl,
      fileName: safeName,
      originalName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

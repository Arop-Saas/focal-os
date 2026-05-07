import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: { workspaces: { include: { workspace: true }, take: 1 } },
    });
    if (!user?.workspaces[0]) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 });
    }
    const workspace = user.workspaces[0].workspace;

    // Parse file
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use PNG, JPG, WebP, or SVG." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 2MB." },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const storageKey = `workspace-logos/${workspace.id}/logo-${Date.now()}.${ext}`;

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
        upsert: true, // Replace any existing logo
      });

    if (uploadError) {
      console.error("Logo upload error:", uploadError);
      return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = adminClient.storage
      .from("galleries")
      .getPublicUrl(storageKey);

    // Persist to workspace record
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { logoUrl: publicUrl },
    });

    return NextResponse.json({ logoUrl: publicUrl });
  } catch (err) {
    console.error("Logo upload route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

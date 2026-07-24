import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ensurePrivateBucket, PRIVATE_MEDIA_BUCKET } from "@/lib/gallery-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Raw capture files: any type (RAW/DNG/CR3/ZIP/…), generous per-file cap.
const MAX_RAW_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

export async function POST(req: NextRequest) {
  try {
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
    const workspaceId = user.workspaces[0].workspace.id;

    const body = await req.json() as { jobId: string; fileName: string; mimeType: string; fileSize: number };
    const { jobId, fileName, mimeType, fileSize } = body;
    if (!jobId || !fileName) {
      return NextResponse.json({ error: "jobId and fileName are required" }, { status: 400 });
    }
    if (fileSize > MAX_RAW_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 2GB." }, { status: 400 });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, workspaceId },
      select: { id: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storageKey = `raw/${workspaceId}/${jobId}/${safeName}`;

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await ensurePrivateBucket();
    const { data, error } = await adminClient.storage
      .from(PRIVATE_MEDIA_BUCKET)
      .createSignedUploadUrl(storageKey);

    if (error || !data) {
      console.error("Raw upload URL error:", error);
      return NextResponse.json({ error: "Could not create upload URL" }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storageKey,
      fileName: safeName,
      originalName: fileName,
      mimeType: mimeType || "application/octet-stream",
      fileSize,
    });
  } catch (err) {
    console.error("Raw upload URL route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

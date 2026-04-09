import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const fetchCache = "force-no-store";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: { workspaces: { include: { workspace: true }, take: 1 } },
    });
    if (!user?.workspaces[0]) return NextResponse.json({ error: "No workspace" }, { status: 403 });
    const workspace = user.workspaces[0].workspace;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const productType = formData.get("type") as string | null; // "service" or "package"
    const productId = formData.get("productId") as string | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!productType || !productId) return NextResponse.json({ error: "Missing type or productId" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Invalid file type. Use PNG, JPG, or WebP." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large. Maximum 5MB." }, { status: 400 });

    // Verify ownership (skip for new products being created — productId may be "new")
    if (productId !== "new") {
      if (productType === "service") {
        const svc = await prisma.service.findFirst({ where: { id: productId, workspaceId: workspace.id } });
        if (!svc) return NextResponse.json({ error: "Service not found" }, { status: 404 });
      } else if (productType === "package") {
        const pkg = await prisma.package.findFirst({ where: { id: productId, workspaceId: workspace.id } });
        if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });
      }
    }

    if (!["service", "package"].includes(productType!)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const storageKey = `product-images/${workspace.id}/${productType}-${productId || "new"}-${Date.now()}.${ext}`;

    const { createClient: createAdminSupabase } = await import("@supabase/supabase-js");
    const adminClient = createAdminSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await adminClient.storage.from("galleries").upload(storageKey, buffer, { contentType: file.type, upsert: true });
    if (uploadError) return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });

    const { data: { publicUrl } } = adminClient.storage.from("galleries").getPublicUrl(storageKey);

    return NextResponse.json({ coverImage: publicUrl });
  } catch (err) {
    console.error("Product image upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { PortalSettings } from "@/lib/booking-form-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const ws = await prisma.workspace.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      brandColor: true,
      phone: true,
      email: true,
      portalSettings: true,
      orderForms: {
        where: { isPublic: true },
        select: { id: true, title: true, description: true, coverImage: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: ws.name,
    slug: ws.slug,
    logoUrl: ws.logoUrl,
    brandColor: ws.brandColor,
    phone: ws.phone,
    email: ws.email,
    portalSettings: (ws.portalSettings as PortalSettings | null) ?? null,
    orderForms: ws.orderForms,
  });
}

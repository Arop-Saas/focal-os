import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-session";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const session = await getPortalSession(slug);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { firstName, lastName, phone, company } = await req.json();

    const updated = await prisma.client.update({
      where: { id: session.client.id },
      data: {
        ...(firstName && { firstName: firstName.trim() }),
        ...(lastName && { lastName: lastName.trim() }),
        phone: phone?.trim() ?? null,
        company: company?.trim() ?? null,
      },
    });

    return NextResponse.json({ ok: true, client: updated });
  } catch (err) {
    console.error("Portal profile update error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generatePortalToken, MAGIC_LINK_TTL_MS } from "@/lib/portal-auth";

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, phone, company, workspaceSlug } = await req.json();

    if (!firstName || !lastName || !email || !workspaceSlug) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
    });

    if (!workspace) {
      return NextResponse.json({ ok: true }); // Don't leak workspace existence
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Upsert client — if they already exist just update their info
    const client = await prisma.client.upsert({
      where: {
        // Use a compound approach: find existing by email+workspace
        id: (await prisma.client.findFirst({
          where: { workspaceId: workspace.id, email: normalizedEmail },
          select: { id: true },
        }))?.id ?? "new",
      },
      update: {
        firstName,
        lastName,
        phone: phone || undefined,
        company: company || undefined,
        source: "portal",
      },
      create: {
        workspaceId: workspace.id,
        firstName,
        lastName,
        email: normalizedEmail,
        phone: phone || undefined,
        company: company || undefined,
        source: "portal",
        status: "ACTIVE",
      },
    });

    // Generate magic link so they can sign in immediately
    const token = generatePortalToken({
      clientId: client.id,
      email: client.email,
      workspaceSlug,
      exp: Date.now() + MAGIC_LINK_TTL_MS,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://focal-os.vercel.app";
    const magicLink = `${baseUrl}/api/portal/verify?token=${encodeURIComponent(token)}&slug=${workspaceSlug}`;

    return NextResponse.json({ ok: true, redirectUrl: magicLink });
  } catch (err) {
    console.error("[portal/request-access]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

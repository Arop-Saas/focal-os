import { NextRequest, NextResponse } from "next/server";
import { scryptSync, randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { generatePortalToken, MAGIC_LINK_TTL_MS } from "@/lib/portal-auth";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, phone, company, password, workspaceSlug } = await req.json();

    if (!firstName || !lastName || !email || !workspaceSlug) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
    });

    if (!workspace) {
      return NextResponse.json({ ok: true }); // Don't leak workspace existence
    }

    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = hashPassword(password);

    // Upsert client — if they already exist update their info + password
    const client = await prisma.client.upsert({
      where: {
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
        passwordHash,
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
        passwordHash,
      },
    });

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

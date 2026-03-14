import { NextRequest, NextResponse } from "next/server";
import { scryptSync, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { generatePortalToken, MAGIC_LINK_TTL_MS } from "@/lib/portal-auth";

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    const hashBuffer = Buffer.from(hash, "hex");
    const suppliedHash = scryptSync(password, salt, 64);
    return timingSafeEqual(hashBuffer, suppliedHash);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, workspaceSlug } = await req.json();

    if (!email || !workspaceSlug) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const client = await prisma.client.findFirst({
      where: {
        workspaceId: workspace.id,
        email: email.toLowerCase().trim(),
      },
    });

    if (!client) {
      return NextResponse.json({ error: "No account found with that email address." }, { status: 404 });
    }

    // If account has a password set, verify it
    if (client.passwordHash) {
      if (!password) {
        return NextResponse.json({ error: "Password required." }, { status: 400 });
      }
      if (!verifyPassword(password, client.passwordHash)) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
      }
    }

    const token = generatePortalToken({
      clientId: client.id,
      email: client.email,
      workspaceSlug,
      exp: Date.now() + MAGIC_LINK_TTL_MS,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://focal-os.vercel.app";
    const magicLink = `${baseUrl}/api/portal/verify?token=${encodeURIComponent(token)}&slug=${workspaceSlug}`;

    return NextResponse.json({ ok: true, redirectUrl: magicLink });
  } catch (err) {
    console.error("Portal login error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

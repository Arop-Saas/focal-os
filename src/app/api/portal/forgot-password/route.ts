import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import prisma from "@/lib/prisma";

const SECRET = process.env.CRON_SECRET ?? "focal-portal-secret";
const TTL_MS = 15 * 60 * 1000; // 15 minutes

export function generateResetToken(clientId: string, email: string, workspaceSlug: string): string {
  const payload = Buffer.from(
    JSON.stringify({ clientId, email, workspaceSlug, exp: Date.now() + TTL_MS, purpose: "reset" })
  ).toString("base64url");
  const sig = createHmac("sha256", SECRET + ":reset").update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
  try {
    const { email, workspaceSlug } = await req.json();
    if (!email || !workspaceSlug) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const client = await prisma.client.findFirst({
      where: { workspaceId: workspace.id, email: email.toLowerCase().trim() },
    });

    if (!client) {
      return NextResponse.json({ error: "No account found with that email address." }, { status: 404 });
    }

    const token = generateResetToken(client.id, client.email, workspaceSlug);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://focal-os.vercel.app";
    const resetUrl = `${baseUrl}/portal/${workspaceSlug}/reset-password?token=${encodeURIComponent(token)}`;

    return NextResponse.json({ ok: true, redirectUrl: resetUrl });
  } catch (err) {
    console.error("[portal/forgot-password]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

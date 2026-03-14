import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { generatePortalToken, MAGIC_LINK_TTL_MS } from "@/lib/portal-auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    // Auth: must be a logged-in studio user
    const supabase = await createClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (!supabaseUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const studioUser = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: { workspaces: { include: { workspace: true }, take: 1 } },
    });

    if (!studioUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = studioUser.workspaces[0]?.workspace;
    if (!workspace) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const { clientId } = await req.json();
    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    // Make sure client belongs to this workspace
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client || client.workspaceId !== workspace.id) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Generate a 15-minute magic link
    const token = generatePortalToken({
      clientId: client.id,
      email: client.email,
      workspaceSlug: workspace.slug,
      exp: Date.now() + MAGIC_LINK_TTL_MS,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://focal-os.vercel.app";
    const magicLink = `${baseUrl}/api/portal/verify?token=${encodeURIComponent(token)}&slug=${workspace.slug}`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? `${workspace.name} <onboarding@resend.dev>`,
      to: client.email,
      subject: `You've been invited to the ${workspace.name} client portal`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px; background: #ffffff;">
          <div style="margin-bottom: 32px;">
            <div style="width: 40px; height: 40px; background: ${workspace.brandColor ?? "#1B4F9E"}; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 20px;">📷</span>
            </div>
          </div>
          <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 8px;">You're invited to your client portal</h2>
          <p style="color: #64748b; margin: 0 0 24px;">Hi ${client.firstName}, <strong>${workspace.name}</strong> has invited you to your dedicated client portal — where you can view your orders, galleries, and invoices all in one place.</p>
          <a href="${magicLink}" style="display: inline-block; background: ${workspace.brandColor ?? "#1B4F9E"}; color: white; padding: 13px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-bottom: 24px;">
            Access your portal →
          </a>
          <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px;">This link expires in 15 minutes. After signing in you'll stay logged in for 7 days.</p>
          <p style="color: #94a3b8; font-size: 13px; margin: 0;">If you didn't expect this email, you can safely ignore it.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Portal invite error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatePortalToken, MAGIC_LINK_TTL_MS } from "@/lib/portal-auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email, workspaceSlug } = await req.json();

    if (!email || !workspaceSlug) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const workspace = await db.workspace.findUnique({
      where: { slug: workspaceSlug },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const client = await db.client.findFirst({
      where: {
        workspaceId: workspace.id,
        email: email.toLowerCase().trim(),
      },
    });

    // Always return ok — don't reveal if email exists
    if (!client) {
      return NextResponse.json({ ok: true });
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

    await resend.emails.send({
      from: `${workspace.name} <${process.env.EMAIL_FROM ?? "noreply@focal-os.vercel.app"}>`,
      to: client.email,
      subject: `Sign in to ${workspace.name} Client Portal`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px; background: #ffffff;">
          <div style="margin-bottom: 32px;">
            <div style="width: 40px; height: 40px; background: ${workspace.brandColor ?? "#1B4F9E"}; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 20px;">📷</span>
            </div>
          </div>
          <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 8px;">Sign in to your portal</h2>
          <p style="color: #64748b; margin: 0 0 24px;">Hi ${client.firstName}, click the button below to sign in to the <strong>${workspace.name}</strong> client portal. This link expires in 15 minutes.</p>
          <a href="${magicLink}" style="display: inline-block; background: ${workspace.brandColor ?? "#1B4F9E"}; color: white; padding: 13px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-bottom: 24px;">
            Sign in to portal →
          </a>
          <p style="color: #94a3b8; font-size: 13px; margin: 0;">If you didn't request this, you can ignore this email. This link will expire in 15 minutes.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Portal login error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

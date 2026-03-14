import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generatePortalToken, MAGIC_LINK_TTL_MS } from "@/lib/portal-auth";
import { resend, EMAIL_FROM } from "@/lib/resend";

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

    // Email the client their sign-in link
    await resend.emails.send({
      from: EMAIL_FROM,
      to: normalizedEmail,
      subject: `Welcome to the ${workspace.name} Client Portal`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;background:#ffffff;">
          <div style="margin-bottom:32px;">
            <div style="width:40px;height:40px;background:${workspace.brandColor ?? "#1B4F9E"};border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:20px;">📷</span>
            </div>
          </div>
          <h2 style="color:#0f172a;font-size:22px;font-weight:700;margin:0 0 8px;">Welcome, ${firstName}!</h2>
          <p style="color:#64748b;margin:0 0 24px;">Your account has been created for the <strong>${workspace.name}</strong> client portal. Click below to sign in and get started.</p>
          <a href="${magicLink}" style="display:inline-block;background:${workspace.brandColor ?? "#1B4F9E"};color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px;">
            Access your portal →
          </a>
          <p style="color:#94a3b8;font-size:13px;margin:0;">This link expires in 15 minutes. You can always request a new one from the portal sign-in page.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[portal/request-access]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

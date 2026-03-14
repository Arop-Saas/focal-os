import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { resend, EMAIL_FROM } from "@/lib/resend";

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, phone, workspaceSlug } = await req.json();

    if (!firstName || !lastName || !email || !workspaceSlug) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Look up workspace + owner email
    const workspace = await prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      include: {
        members: {
          where: { role: "OWNER" },
          include: { user: { select: { email: true, firstName: true } } },
          take: 1,
        },
      },
    });

    if (!workspace) {
      // Return ok anyway — don't leak workspace existence
      return NextResponse.json({ ok: true });
    }

    const ownerEmail = workspace.members[0]?.user?.email;
    if (ownerEmail) {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: ownerEmail,
        subject: `New portal access request — ${firstName} ${lastName}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111;">
            <h2 style="margin-bottom:4px;">New Portal Access Request</h2>
            <p style="color:#666;margin-top:0;">Someone requested access to your <strong>${workspace.name}</strong> client portal.</p>

            <table style="width:100%;border-collapse:collapse;margin:24px 0;">
              <tr>
                <td style="padding:8px 0;color:#666;width:120px;">Name</td>
                <td style="padding:8px 0;font-weight:600;">${firstName} ${lastName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#666;">Email</td>
                <td style="padding:8px 0;font-weight:600;">${email}</td>
              </tr>
              ${phone ? `<tr>
                <td style="padding:8px 0;color:#666;">Phone</td>
                <td style="padding:8px 0;font-weight:600;">${phone}</td>
              </tr>` : ""}
            </table>

            <p style="color:#666;font-size:14px;">
              To give them access, add them as a client in your Focal OS dashboard and they'll be able to sign in using their email.
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[portal/request-access]", err);
    return NextResponse.json({ ok: true }); // Always return ok — don't expose errors
  }
}

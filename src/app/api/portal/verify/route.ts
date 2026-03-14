import { NextRequest, NextResponse } from "next/server";
import {
  verifyPortalToken,
  generatePortalToken,
  PORTAL_COOKIE,
  PORTAL_TOKEN_TTL_MS,
} from "@/lib/portal-auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");

  const errorUrl = (msg: string) =>
    new URL(`/portal/${slug ?? ""}?error=${msg}`, req.url);

  if (!token || !slug) {
    return NextResponse.redirect(errorUrl("invalid"));
  }

  const session = verifyPortalToken(token);
  if (!session || session.workspaceSlug !== slug) {
    return NextResponse.redirect(errorUrl("expired"));
  }

  // Stamp portal access timestamp (fire-and-forget)
  prisma.client
    .update({
      where: { id: session.clientId },
      data: { portalAccessedAt: new Date() },
    })
    .catch(() => {});

  // Issue a 7-day session cookie
  const sessionToken = generatePortalToken({
    ...session,
    exp: Date.now() + PORTAL_TOKEN_TTL_MS,
  });

  const response = NextResponse.redirect(
    new URL(`/portal/${slug}/dashboard`, req.url)
  );

  response.cookies.set(PORTAL_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return response;
}

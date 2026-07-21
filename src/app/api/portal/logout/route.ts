import { NextRequest, NextResponse } from "next/server";
import {
  PORTAL_COOKIE,
  PORTAL_SESSION_COOKIE_PREFIX,
  hashPortalSessionToken,
} from "@/lib/portal-auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";

  // S8 (R8): kill the server-side session row, not just the cookie.
  const cookieValue = req.cookies.get(PORTAL_COOKIE)?.value;
  if (cookieValue?.startsWith(PORTAL_SESSION_COOKIE_PREFIX)) {
    const rawToken = cookieValue.slice(PORTAL_SESSION_COOKIE_PREFIX.length);
    if (rawToken) {
      try {
        await prisma.portalSession.updateMany({
          where: { tokenHash: hashPortalSessionToken(rawToken), revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } catch {
        // Logout must never fail the redirect — cookie still gets cleared.
      }
    }
  }

  const response = NextResponse.redirect(new URL(`/portal/${slug}`, req.url));
  response.cookies.delete(PORTAL_COOKIE);
  return response;
}

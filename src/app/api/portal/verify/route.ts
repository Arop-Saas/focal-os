import { NextRequest, NextResponse } from "next/server";
import {
  verifyPortalToken,
  createPortalDbSession,
  PORTAL_COOKIE,
  PORTAL_SESSION_TTL_SECONDS,
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

  // The magic-link payload is only trusted as far as the DB confirms it:
  // client must exist, belong to this workspace, and not be revoked since.
  const [client, workspace] = await Promise.all([
    prisma.client.findUnique({ where: { id: session.clientId } }),
    prisma.workspace.findUnique({ where: { slug } }),
  ]);
  if (!client || !workspace || client.workspaceId !== workspace.id) {
    return NextResponse.redirect(errorUrl("invalid"));
  }
  if (
    client.portalRevokedAt &&
    session.exp - 72 * 60 * 60 * 1000 < client.portalRevokedAt.getTime()
  ) {
    // Magic link minted before access was revoked — refuse it.
    return NextResponse.redirect(errorUrl("revoked"));
  }

  // Stamp portal access timestamp (fire-and-forget)
  prisma.client
    .update({
      where: { id: session.clientId },
      data: { portalAccessedAt: new Date() },
    })
    .catch(() => {});

  // S8 (R8): issue a revocable server-side session instead of a stateless token.
  const { cookieValue } = await createPortalDbSession(prisma, {
    workspaceId: workspace.id,
    clientId: client.id,
    userAgent: req.headers.get("user-agent"),
  });

  const response = NextResponse.redirect(
    new URL(`/portal/${slug}/dashboard`, req.url)
  );

  response.cookies.set(PORTAL_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PORTAL_SESSION_TTL_SECONDS,
    path: "/",
  });

  return response;
}

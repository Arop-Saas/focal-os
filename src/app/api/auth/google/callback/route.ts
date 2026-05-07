/**
 * GET /api/auth/google/callback
 * Handles the OAuth callback from Google.
 * Stores the refresh token on the User record and redirects to settings.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { exchangeCodeForTokens } from "@/lib/gcal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const userId = searchParams.get("state"); // we passed userId as state
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error || !code || !userId) {
    return NextResponse.redirect(
      `${baseUrl}/settings?gcal=error&reason=${encodeURIComponent(error ?? "missing_params")}`
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      // refresh_token is only sent on first consent — if missing, user already connected
      return NextResponse.redirect(`${baseUrl}/settings?gcal=already_connected`);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        googleRefreshToken: tokens.refresh_token,
        googleCalendarId: "primary",
      },
    });

    return NextResponse.redirect(`${baseUrl}/settings?gcal=connected`);
  } catch (err) {
    console.error("[gcal callback] error:", err);
    return NextResponse.redirect(`${baseUrl}/settings?gcal=error&reason=token_exchange_failed`);
  }
}

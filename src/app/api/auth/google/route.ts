/**
 * GET /api/auth/google
 * Initiates the Google Calendar OAuth flow for the logged-in user.
 * Redirects to Google's consent screen.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getAuthUrl } from "@/lib/gcal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  if (!supabaseUser) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const authUrl = getAuthUrl(user.id);
  return NextResponse.redirect(authUrl);
}

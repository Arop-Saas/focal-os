import { NextRequest, NextResponse } from "next/server";
import { PORTAL_COOKIE } from "@/lib/portal-auth";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const response = NextResponse.redirect(new URL(`/portal/${slug}`, req.url));
  response.cookies.delete(PORTAL_COOKIE);
  return response;
}

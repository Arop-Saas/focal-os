import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const session = await getPortalSession(slug);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { client, workspace } = session;

  return NextResponse.json({
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      company: client.company,
    },
    workspace: {
      name: workspace.name,
      brandColor: workspace.brandColor,
    },
  });
}

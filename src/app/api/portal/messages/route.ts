import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-session";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/portal/messages?slug=xxx&jobId=yyy
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug = searchParams.get("slug");
  const jobId = searchParams.get("jobId");

  if (!slug || !jobId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const session = await getPortalSession(slug);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify job belongs to this client & workspace
  const job = await prisma.job.findFirst({
    where: { id: jobId, workspaceId: session.workspace.id, clientId: session.client.id },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await prisma.jobMessage.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
  });

  // Mark staff messages as read when client views
  await prisma.jobMessage.updateMany({
    where: { jobId, senderType: "STAFF", readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json(messages);
}

// POST /api/portal/messages
export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug = searchParams.get("slug");

  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const session = await getPortalSession(slug);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, message } = body;

  if (!jobId || !message?.trim()) {
    return NextResponse.json({ error: "Missing jobId or message" }, { status: 400 });
  }

  // Verify job belongs to this client & workspace
  const job = await prisma.job.findFirst({
    where: { id: jobId, workspaceId: session.workspace.id, clientId: session.client.id },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const senderName = `${session.client.firstName} ${session.client.lastName}`;

  const created = await prisma.jobMessage.create({
    data: {
      jobId,
      workspaceId: session.workspace.id,
      senderType: "CLIENT",
      senderName,
      body: message.trim(),
    },
  });

  return NextResponse.json(created, { status: 201 });
}

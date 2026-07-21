/**
 * POST /api/portal/reschedule — client self-service reschedule (S8).
 *
 * Auth: revocable portal session. Policy: only PENDING/CONFIRMED/ASSIGNED
 * jobs, both old and new time ≥ MIN_NOTICE_HOURS out. The actual slot is
 * validated by the same scheduling engine that guards every other surface.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-session";
import prisma from "@/lib/prisma";
import {
  rescheduleJob,
  RescheduleNotAllowedError,
  SlotUnavailableError,
} from "@/lib/scheduling/reschedule";

export const dynamic = "force-dynamic";

const MIN_NOTICE_HOURS = 24; // portal policy — surface as a workspace setting post-beta
const PORTAL_RESCHEDULABLE = ["PENDING", "CONFIRMED", "ASSIGNED"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const slug: unknown = body?.slug;
    const jobId: unknown = body?.jobId;
    const scheduledAt: unknown = body?.scheduledAt;

    if (
      typeof slug !== "string" ||
      typeof jobId !== "string" ||
      typeof scheduledAt !== "string"
    ) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const newTime = new Date(scheduledAt);
    if (Number.isNaN(newTime.getTime())) {
      return NextResponse.json({ error: "Invalid time" }, { status: 400 });
    }

    const session = await getPortalSession(slug);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        workspaceId: session.workspace.id,
        clientId: session.client.id, // ownership — clients move only their own shoots
      },
      select: { id: true, status: true, scheduledAt: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const minNoticeMs = MIN_NOTICE_HOURS * 3600e3;
    if (job.scheduledAt && job.scheduledAt.getTime() - Date.now() < minNoticeMs) {
      return NextResponse.json(
        {
          error: `Shoots less than ${MIN_NOTICE_HOURS} hours away can't be moved online — please contact the studio directly.`,
        },
        { status: 422 }
      );
    }
    if (newTime.getTime() - Date.now() < minNoticeMs) {
      return NextResponse.json(
        { error: `New times must be at least ${MIN_NOTICE_HOURS} hours from now.` },
        { status: 422 }
      );
    }

    // Owner gets the bell notification for portal-initiated moves.
    const owner = await prisma.workspaceMember.findFirst({
      where: { workspaceId: session.workspace.id, role: "OWNER" },
      select: { userId: true },
    });

    const result = await rescheduleJob(prisma, {
      workspaceId: session.workspace.id,
      jobId: job.id,
      newTime,
      actor: { userId: null, label: "client-portal" },
      notifyUserId: owner?.userId,
      allowedStatuses: PORTAL_RESCHEDULABLE,
    });

    return NextResponse.json({
      ok: true,
      changed: result.changed,
      scheduledAt: newTime.toISOString(),
    });
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json(
        { error: "That time was just taken — please pick another slot." },
        { status: 409 }
      );
    }
    if (err instanceof RescheduleNotAllowedError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("[portal reschedule] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

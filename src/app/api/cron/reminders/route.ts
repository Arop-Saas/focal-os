/**
 * GET /api/cron/reminders
 *
 * Vercel Cron Job — runs every hour.
 * Finds all jobs scheduled 23–25 hours from now that haven't had
 * a reminder sent yet, and fires the 24h reminder email to the client.
 *
 * Security: protected by CRON_SECRET environment variable.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyJobReminder } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron (or an authorised caller)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Window: jobs scheduled 23h–25h from now (catches the cron running
  // once per hour without double-sending)
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // Find upcoming jobs in the window that haven't had a JOB_REMINDER sent
  const upcomingJobs = await prisma.job.findMany({
    where: {
      scheduledAt: { gte: windowStart, lte: windowEnd },
      status: { in: ["CONFIRMED", "ASSIGNED", "IN_PROGRESS"] },
      // Exclude jobs that already have a reminder notification sent
      notifications: {
        none: {
          type: "JOB_REMINDER",
          channel: "EMAIL",
          status: "SENT",
        },
      },
    },
    include: {
      client: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  let sent = 0;
  let skipped = 0;

  await Promise.allSettled(
    upcomingJobs.map(async (job) => {
      if (!job.client.email || !job.scheduledAt) {
        skipped++;
        return;
      }

      await notifyJobReminder({
        workspaceId: job.workspaceId,
        jobId: job.id,
        clientEmail: job.client.email,
        clientName: `${job.client.firstName} ${job.client.lastName}`,
        jobNumber: job.jobNumber,
        propertyAddress: job.propertyAddress,
        scheduledAt: job.scheduledAt,
        accessNotes: job.accessNotes,
      });

      sent++;
    })
  );

  console.log(`[cron/reminders] Sent ${sent} reminders, skipped ${skipped} (no email/date)`);

  return NextResponse.json({
    ok: true,
    jobsFound: upcomingJobs.length,
    remindersSent: sent,
    skipped,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  });
}

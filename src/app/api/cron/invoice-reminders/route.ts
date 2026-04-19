/**
 * GET /api/cron/invoice-reminders
 *
 * Vercel Cron Job — runs daily at 8 AM.
 *
 * Two responsibilities:
 *  1. PRE-DUE reminders: finds invoices (SENT/VIEWED/PARTIAL) whose due date
 *     is N days away (configurable per workspace via reminderDaysBefore) and
 *     sends a payment reminder email to the client.
 *  2. OVERDUE repeat reminders: finds OVERDUE invoices and re-sends an overdue
 *     notice every `reminderOverdueRepeat` days (configurable per workspace).
 *
 * De-duplication: uses Notification records to prevent double-sending.
 * A reminder for "X days before due" is only sent once per invoice.
 * Overdue repeats check the last INVOICE_OVERDUE EMAIL notification date.
 *
 * Security: protected by CRON_SECRET environment variable.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyInvoiceReminder, notifyInvoiceOverdue } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let predueSent = 0;
  let overdueSent = 0;
  let skipped = 0;

  // ─── 1. Pre-due reminders ─────────────────────────────────────────────────

  // Get all workspaces that have reminders enabled
  // Note: reminderEnabled/reminderDaysBefore/reminderOverdueRepeat are new fields —
  // after `prisma db push` the Prisma client will recognise them. Until then we cast.
  const workspaces = await prisma.workspace.findMany({
    where: { reminderEnabled: true } as any,
    select: {
      id: true,
      name: true,
      reminderDaysBefore: true,
      reminderOverdueRepeat: true,
    } as any,
  }) as unknown as Array<{ id: string; name: string; reminderDaysBefore: string; reminderOverdueRepeat: number }>;

  for (const ws of workspaces) {
    // Parse reminder days (e.g. "7,3,1" → [7, 3, 1])
    const reminderDays = (ws.reminderDaysBefore ?? "7,3,1")
      .split(",")
      .map((d: string) => parseInt(d.trim(), 10))
      .filter((d: number) => !isNaN(d) && d > 0);

    if (reminderDays.length > 0) {
      // Find unpaid invoices for this workspace that are approaching their due date
      const unpaidInvoices = await prisma.invoice.findMany({
        where: {
          workspaceId: ws.id,
          status: { in: ["SENT", "VIEWED", "PARTIAL"] },
          dueAt: { not: null },
        },
        include: {
          client: { select: { email: true, firstName: true, lastName: true } },
        },
      });

      for (const invoice of unpaidInvoices) {
        if (!invoice.dueAt || !invoice.client.email) {
          skipped++;
          continue;
        }

        const dueDate = new Date(invoice.dueAt);
        const diffMs = dueDate.getTime() - todayStart.getTime();
        const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // Check if today matches one of the reminder days
        if (!reminderDays.includes(daysUntilDue)) continue;

        // De-dup: check if we already sent a reminder for this exact day count
        const existingReminder = await prisma.notification.findFirst({
          where: {
            workspaceId: ws.id,
            type: "INVOICE_REMINDER" as any,
            channel: "EMAIL",
            status: "SENT",
            body: { contains: `due in ${daysUntilDue} days` },
            title: { contains: invoice.invoiceNumber },
          },
        });

        if (existingReminder) continue;

        const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";
        const paymentLink = invoice.paymentLink ?? `${APP_URL}/pay/${invoice.id}`;

        await notifyInvoiceReminder({
          workspaceId: ws.id,
          jobId: invoice.jobId ?? undefined,
          clientEmail: invoice.client.email,
          clientName: `${invoice.client.firstName} ${invoice.client.lastName}`,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amountDue,
          dueDate,
          paymentLink,
          daysUntilDue,
        });

        predueSent++;
      }
    }

    // ─── 2. Overdue repeat reminders ──────────────────────────────────────────

    const repeatDays = ws.reminderOverdueRepeat ?? 7;
    if (repeatDays <= 0) continue; // 0 = no repeat reminders

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        workspaceId: ws.id,
        status: "OVERDUE",
      },
      include: {
        client: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    for (const invoice of overdueInvoices) {
      if (!invoice.dueAt || !invoice.client.email) {
        skipped++;
        continue;
      }

      const dueDate = new Date(invoice.dueAt);
      const daysOverdue = Math.floor(
        (todayStart.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check last overdue email notification for this invoice
      const lastOverdueEmail = await prisma.notification.findFirst({
        where: {
          workspaceId: ws.id,
          type: "INVOICE_OVERDUE" as any,
          channel: "EMAIL",
          status: "SENT",
          title: { contains: invoice.invoiceNumber },
        },
        orderBy: { sentAt: "desc" },
      });

      if (lastOverdueEmail?.sentAt) {
        const daysSinceLastEmail = Math.floor(
          (todayStart.getTime() - lastOverdueEmail.sentAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastEmail < repeatDays) continue; // Too soon
      }

      const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";
      const paymentLink = invoice.paymentLink ?? `${APP_URL}/pay/${invoice.id}`;

      await notifyInvoiceOverdue({
        workspaceId: ws.id,
        jobId: invoice.jobId ?? undefined,
        clientEmail: invoice.client.email,
        clientName: `${invoice.client.firstName} ${invoice.client.lastName}`,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amountDue,
        dueDate,
        paymentLink,
        daysOverdue,
      });

      overdueSent++;
    }
  }

  console.log(
    `[cron/invoice-reminders] Pre-due: ${predueSent}, Overdue: ${overdueSent}, Skipped: ${skipped}`
  );

  return NextResponse.json({
    ok: true,
    predueSent,
    overdueSent,
    skipped,
    workspacesChecked: workspaces.length,
    checkedAt: now.toISOString(),
  });
}

/**
 * GET /api/cron/overdue
 *
 * Vercel Cron Job — runs daily at 6 AM.
 * Finds all SENT / VIEWED / PARTIAL invoices whose due date has passed
 * and marks them OVERDUE, then writes an in-app notification for each.
 *
 * Security: protected by CRON_SECRET environment variable.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all invoices that are past due but not yet marked OVERDUE
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["SENT", "VIEWED", "PARTIAL"] },
      dueAt: { lt: now },
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
    },
  });

  if (overdueInvoices.length === 0) {
    return NextResponse.json({ ok: true, marked: 0 });
  }

  let marked = 0;

  await Promise.allSettled(
    overdueInvoices.map(async (invoice) => {
      await prisma.$transaction([
        // Mark as OVERDUE
        prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "OVERDUE" },
        }),
        // Activity log
        prisma.activityLog.create({
          data: {
            workspaceId: invoice.workspaceId,
            action: "invoice.overdue",
            entityType: "invoice",
            entityId: invoice.id,
            metadata: {
              invoiceNumber: invoice.invoiceNumber,
              amountDue: invoice.amountDue,
              dueAt: invoice.dueAt?.toISOString(),
              clientName: invoice.client
                ? `${invoice.client.firstName} ${invoice.client.lastName}`
                : "Unknown",
            },
          },
        }),
        // In-app notification
        prisma.notification.create({
          data: {
            workspaceId: invoice.workspaceId,
            type: "INVOICE_OVERDUE" as any,
            channel: "IN_APP",
            status: "DELIVERED",
            title: `Invoice overdue — ${invoice.invoiceNumber}`,
            body: `$${invoice.amountDue.toFixed(2)} past due${
              invoice.client
                ? ` · ${invoice.client.firstName} ${invoice.client.lastName}`
                : ""
            }`,
            sentAt: now,
          },
        }),
      ]);

      marked++;
    })
  );

  console.log(`[cron/overdue] Marked ${marked} invoices as OVERDUE`);

  return NextResponse.json({
    ok: true,
    marked,
    invoicesFound: overdueInvoices.length,
    checkedAt: now.toISOString(),
  });
}

/**
 * core/delivery — the ONE place job-delivery side effects happen.
 *
 * Called by BOTH delivery paths (gallery.publish and jobs.update→DELIVERED)
 * so they can never drift apart again:
 *  - stamps Job.deliveredAt (SLA: shoot → delivery, Build Brief W5)
 *  - sends the delivery email with the REAL gallery link
 *  - auto-creates + sends the invoice (Build Brief W6) when enabled
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { notifyJobDelivered, notifyInvoiceSent } from "@/lib/notify";
import { createInvoiceForJob, InvoiceExistsError } from "@/lib/money/invoice";

type Db = PrismaClient | Prisma.TransactionClient;

export async function runDeliverySideEffects(
  db: Db,
  args: { workspaceId: string; jobId: string; userId?: string }
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";

  const job = await db.job.findFirst({
    where: { id: args.jobId, workspaceId: args.workspaceId },
    include: {
      client: { select: { firstName: true, lastName: true, email: true } },
      gallery: { select: { slug: true } },
    },
  });
  if (!job) return;

  // SLA timestamp — first delivery only
  if (!job.deliveredAt) {
    await db.job.update({
      where: { id: job.id },
      data: { deliveredAt: new Date() },
    });
  }

  const clientName = job.client
    ? `${job.client.firstName} ${job.client.lastName}`
    : "there";

  if (job.client?.email) {
    void notifyJobDelivered({
      workspaceId: args.workspaceId,
      jobId: job.id,
      userId: args.userId,
      clientEmail: job.client.email,
      clientName,
      jobNumber: job.jobNumber,
      propertyAddress: job.propertyAddress,
      galleryUrl: job.gallery?.slug ? `${base}/g/${job.gallery.slug}` : `${base}/portal`,
    });
  }

  // ── Invoice-on-delivery (idempotent — InvoiceExistsError is fine) ───────
  const ws = await db.workspace.findUnique({
    where: { id: args.workspaceId },
    select: { autoCreateInvoice: true },
  });
  if (!ws?.autoCreateInvoice) return;

  try {
    const created = await createInvoiceForJob(db, {
      workspaceId: args.workspaceId,
      jobId: job.id,
    });
    const payLink = `${base}/pay/${created.payToken ?? created.id}`;
    await db.invoice.update({
      where: { id: created.id },
      data: { status: "SENT", issuedAt: new Date(), paymentLink: payLink },
    });
    if (created.clientEmail) {
      void notifyInvoiceSent({
        workspaceId: args.workspaceId,
        jobId: job.id,
        userId: args.userId,
        clientEmail: created.clientEmail,
        clientName: created.clientName,
        invoiceNumber: created.invoiceNumber,
        amount: created.totalAmount,
        dueDate: created.dueAt,
        paymentLink: payLink,
      });
    }
  } catch (e) {
    if (!(e instanceof InvoiceExistsError)) {
      console.error("invoice-on-delivery failed:", e);
    }
  }
}

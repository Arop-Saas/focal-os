/**
 * core/money — invoice creation.
 *
 * ONE implementation of "make the invoice for this job" (package/à-la-carte
 * pricing, brokerage discounts, tax, atomic numbering), used by:
 *  - invoices.createFromJob (manual button)
 *  - the job-DELIVERED hook (automatic, per Build Brief W6)
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { generateInvoiceNumber } from "@/lib/utils";

type Db = PrismaClient | Prisma.TransactionClient;

export class InvoiceExistsError extends Error {
  constructor() { super("Invoice already exists for this job."); }
}

export interface CreateInvoiceResult {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  payToken: string | null;
  clientEmail: string | null;
  clientName: string;
  jobId: string;
  dueAt: Date;
}

export async function createInvoiceForJob(
  db: Db,
  args: { workspaceId: string; jobId: string }
): Promise<CreateInvoiceResult> {
  const job = await db.job.findFirst({
    where: { id: args.jobId, workspaceId: args.workspaceId },
    include: {
      client: { include: { brokerageGroup: true } },
      package: { include: { items: { select: { serviceId: true } } } },
      services: { include: { service: true } },
      orderLines: { orderBy: { createdAt: "asc" } },
      invoice: { select: { id: true } },
    },
  });
  if (!job) throw new Error("Job not found.");
  if (job.invoice) throw new InvoiceExistsError();
  if (!job.client) throw new Error("Job has no client.");

  // ── Atomic invoice number (no read-then-increment race) ────────────────
  const ws = await db.workspace.update({
    where: { id: args.workspaceId },
    data: { invoiceNextNumber: { increment: 1 } },
    select: { invoiceNextNumber: true, invoicePrefix: true, defaultTaxRate: true, invoiceDueDays: true },
  });
  // update returns the POST-increment value; the number we consume is prev:
  const invoiceNumber = generateInvoiceNumber(ws.invoicePrefix ?? "INV", ws.invoiceNextNumber - 1);

  // ── Line items: bill what the client AGREED to ─────────────────────────
  // Package bookings: one line at the PACKAGE price (constituent services
  // are not billed individually — that's how it was sold), plus any add-on
  // services outside the package. À-la-carte bookings: the services.
  // Fallback: the job total.
  const lineItems: { description: string; quantity: number; unitPrice: number; totalPrice: number; sortOrder: number }[] = [];
  if (job.orderLines.length > 0) {
    // Catalog-era orders: bill the frozen line snapshots — exactly what was
    // quoted, including manually added services.
    job.orderLines.forEach((l, i) =>
      lineItems.push({
        description: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        totalPrice: l.totalPrice,
        sortOrder: i,
      })
    );
  } else if (job.package) {
    lineItems.push({
      description: job.package.name,
      quantity: 1,
      unitPrice: job.package.price,
      totalPrice: job.package.price,
      sortOrder: 0,
    });
    const pkgServiceIds = new Set(job.package.items.map((i) => i.serviceId));
    job.services
      .filter((s) => !pkgServiceIds.has(s.serviceId))
      .forEach((s, i) =>
        lineItems.push({
          description: s.service.name,
          quantity: s.quantity,
          unitPrice: Number(s.unitPrice),
          totalPrice: Number(s.totalPrice),
          sortOrder: i + 1,
        })
      );
  } else if (job.services.length > 0) {
    job.services.forEach((s, i) =>
      lineItems.push({
        description: s.service.name,
        quantity: s.quantity,
        unitPrice: Number(s.unitPrice),
        totalPrice: Number(s.totalPrice),
        sortOrder: i,
      })
    );
  } else {
    lineItems.push({
      description: `Photography — ${job.propertyAddress}`,
      quantity: 1,
      unitPrice: job.totalAmount ?? 0,
      totalPrice: job.totalAmount ?? 0,
      sortOrder: 0,
    });
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.totalPrice, 0);

  // ── Brokerage discount ──────────────────────────────────────────────────
  const brokerageGroup = job.client.brokerageGroup;
  let discountAmount = 0;
  if (brokerageGroup?.isActive) {
    discountAmount =
      brokerageGroup.discountType === "PERCENTAGE"
        ? parseFloat(((subtotal * brokerageGroup.discountValue) / 100).toFixed(2))
        : Math.min(brokerageGroup.discountValue, subtotal);
    if (discountAmount > 0) {
      lineItems.push({
        description:
          brokerageGroup.discountType === "PERCENTAGE"
            ? `${brokerageGroup.name} discount (${brokerageGroup.discountValue}%)`
            : `${brokerageGroup.name} discount`,
        quantity: 1,
        unitPrice: -discountAmount,
        totalPrice: -discountAmount,
        sortOrder: lineItems.length,
      });
    }
  }

  const taxRate = ws.defaultTaxRate ?? 0;
  const taxAmount = parseFloat((((subtotal - discountAmount) * taxRate) / 100).toFixed(2));
  const grossTotal = parseFloat((subtotal - discountAmount + taxAmount).toFixed(2));
  const dueAt = new Date(Date.now() + (ws.invoiceDueDays ?? 30) * 24 * 3600e3);

  // ── S8 (B9): auto-apply available client credit ─────────────────────────
  // Guarded decrement first (never lets the cached balance go negative even
  // under concurrent invoicing), then the invoice line + ledger row. When db
  // is a transaction client the whole block is atomic; standalone, the
  // catch-block compensation restores the balance if invoice creation fails.
  let creditApplied = 0;
  const availableCredit = parseFloat((job.client.creditBalance ?? 0).toFixed(2));
  if (availableCredit > 0 && grossTotal > 0) {
    const toApply = Math.min(availableCredit, grossTotal);
    const guarded = await db.client.updateMany({
      where: { id: job.clientId, creditBalance: { gte: toApply } },
      data: { creditBalance: { decrement: toApply } },
    });
    if (guarded.count === 1) {
      creditApplied = toApply;
      lineItems.push({
        description: "Account credit applied",
        quantity: 1,
        unitPrice: -creditApplied,
        totalPrice: -creditApplied,
        sortOrder: lineItems.length,
      });
    }
  }

  const totalAmount = parseFloat((grossTotal - creditApplied).toFixed(2));

  // Arrow-const (not a hoisted declaration) so TS keeps the `job` null-check
  // narrowing from the top of the function inside the closure.
  const createInvoiceRow = async () =>
    db.invoice.create({
      data: {
        workspaceId: args.workspaceId,
        invoiceNumber,
        payToken: randomUUID(),
        clientId: job.clientId,
        jobId: job.id,
        subtotal,
        taxRate,
        taxAmount,
        discountAmount,
        totalAmount,
        amountDue: totalAmount,
        dueAt,
        lineItems: { create: lineItems },
      },
      select: { id: true, invoiceNumber: true, totalAmount: true, payToken: true },
    });

  let invoice: { id: string; invoiceNumber: string; totalAmount: number; payToken: string | null };
  try {
    invoice = await createInvoiceRow();
  } catch (e) {
    if (creditApplied > 0) {
      // Give the credit back — the invoice never came to exist.
      await db.client
        .update({
          where: { id: job.clientId },
          data: { creditBalance: { increment: creditApplied } },
        })
        .catch(() => {});
    }
    throw e;
  }

  if (creditApplied > 0) {
    await db.clientCredit.create({
      data: {
        workspaceId: args.workspaceId,
        clientId: job.clientId,
        amount: -creditApplied,
        reason: `Applied to invoice ${invoice.invoiceNumber}`,
        invoiceId: invoice.id,
      },
    });
  }

  return {
    ...invoice,
    clientEmail: job.client.email ?? null,
    clientName: `${job.client.firstName} ${job.client.lastName}`,
    jobId: job.id,
    dueAt,
  };
}

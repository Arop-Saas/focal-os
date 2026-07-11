/**
 * POST /api/stripe/webhook — THE client-payment webhook (core/money).
 *
 * One endpoint, one platform secret. Verifies every event with
 * STRIPE_WEBHOOK_SECRET — works for Connect events from every workspace
 * (event.account identifies the studio) and for the platform itself.
 * Fails closed when the secret is missing (no unverified parsing, R6-style).
 *
 * Guarantees:
 *  - IDEMPOTENT: one Payment ledger row per Stripe event id (unique index);
 *    retries and duplicate deliveries can never double-count (R1).
 *  - AMOUNT-VALIDATED: pays down amountDue by what was ACTUALLY charged;
 *    partial payments → PARTIAL, full → PAID (never blind-PAID).
 */
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { platformStripe } from "@/lib/money/stripe";
import { notifyInvoicePaid } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !sig) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = platformStripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status && session.payment_status !== "paid") {
    // async payment methods settle later — ignore the unpaid completion event
    return NextResponse.json({ received: true });
  }

  const invoiceId = session.metadata?.invoiceId;
  const gallerySlug = session.metadata?.gallerySlug;
  if (!invoiceId) {
    console.warn("Webhook: no invoiceId in metadata");
    return NextResponse.json({ received: true });
  }

  const amountPaid = (session.amount_total ?? 0) / 100;
  const paidAt = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ── Idempotency gate: unique Payment per Stripe event ───────────────
      try {
        await tx.payment.create({
          data: {
            invoiceId,
            stripeEventId: event.id,
            amount: amountPaid,
            method: "CARD",
            status: "COMPLETED",
            stripePaymentId: (session.payment_intent as string) ?? null,
            paidAt,
            notes: event.account ? `Connect acct ${event.account}` : null,
          },
        });
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code;
        if (code === "P2002") return { duplicate: true as const };
        throw e;
      }

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { totalAmount: true, amountPaid: true },
      });
      if (!invoice) return { duplicate: false as const, missing: true as const };

      // ── Amount-validated status transition ──────────────────────────────
      const paidTotal = parseFloat((invoice.amountPaid + amountPaid).toFixed(2));
      const remaining = Math.max(0, parseFloat((invoice.totalAmount - paidTotal).toFixed(2)));
      const fullyPaid = remaining <= 0.009;

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: paidTotal,
          amountDue: remaining,
          status: fullyPaid ? "PAID" : "PARTIAL",
          ...(fullyPaid ? { paidAt } : {}),
          stripePaymentIntentId: (session.payment_intent as string) ?? null,
        },
        include: {
          client: { select: { firstName: true, lastName: true, email: true } },
          job: { select: { id: true, jobNumber: true, propertyAddress: true } },
        },
      });
      return { duplicate: false as const, updated, fullyPaid };
    });

    if ("duplicate" in result && result.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if ("missing" in result && result.missing) {
      console.warn(`Webhook: invoice ${invoiceId} not found`);
      return NextResponse.json({ received: true });
    }

    const updated = "updated" in result ? result.updated : null;
    if (updated?.client?.email && "fullyPaid" in result && result.fullyPaid) {
      void notifyInvoicePaid({
        workspaceId: updated.workspaceId,
        jobId: updated.jobId ?? undefined,
        clientEmail: updated.client.email,
        clientName: `${updated.client.firstName} ${updated.client.lastName}`,
        invoiceNumber: updated.invoiceNumber,
        amount: amountPaid,
        paidAt,
      });
    }

    // Pay-to-unlock galleries: a fully paid + delivered gallery completes the job
    if (gallerySlug && "fullyPaid" in result && result.fullyPaid) {
      const gallery = await prisma.gallery.findUnique({
        where: { slug: gallerySlug },
        select: { jobId: true, status: true },
      });
      if (gallery?.jobId && gallery.status === "DELIVERED") {
        await prisma.job.update({ where: { id: gallery.jobId }, data: { status: "COMPLETED" } });
      }
    }
  } catch (err) {
    console.error("Webhook processing failed:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

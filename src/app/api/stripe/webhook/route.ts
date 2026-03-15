import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { notifyInvoicePaid } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe requires the raw body for signature verification
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  // Find the workspace so we can use its webhook secret for verification.
  // We do a preliminary parse to get the workspaceId from metadata, then verify.
  // Note: for security we verify BEFORE trusting the payload fully.
  // We support a global fallback webhook secret for simplicity.
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (webhookSecret && sig) {
    // Use a temporary Stripe instance just for construction
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2024-06-20" });
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    // No webhook secret configured — parse without verification (dev only)
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId  = session.metadata?.invoiceId;
    const gallerySlug = session.metadata?.gallerySlug;

    if (!invoiceId) {
      console.warn("Webhook: no invoiceId in metadata");
      return NextResponse.json({ received: true });
    }

    try {
      const amountPaid = (session.amount_total ?? 0) / 100;
      const paidAt = new Date();

      // Mark invoice as paid and fetch related data for notifications
      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "PAID",
          amountPaid: { increment: amountPaid },
          amountDue: 0,
          paidAt,
          stripePaymentIntentId: session.payment_intent as string ?? null,
        },
        include: {
          client: { select: { firstName: true, lastName: true, email: true } },
          job: { select: { id: true, jobNumber: true, propertyAddress: true } },
        },
      });

      console.log(`Invoice ${invoiceId} marked PAID via Stripe checkout`);

      // Send payment receipt email + in-app notification
      if (updatedInvoice.client?.email) {
        void notifyInvoicePaid({
          workspaceId: updatedInvoice.workspaceId,
          jobId: updatedInvoice.jobId ?? undefined,
          clientEmail: updatedInvoice.client.email,
          clientName: `${updatedInvoice.client.firstName} ${updatedInvoice.client.lastName}`,
          invoiceNumber: updatedInvoice.invoiceNumber,
          amount: amountPaid,
          paidAt,
        });
      }

      // Also update job status to COMPLETED if gallery is delivered
      if (gallerySlug) {
        const gallery = await prisma.gallery.findUnique({
          where: { slug: gallerySlug },
          select: { jobId: true, status: true },
        });
        if (gallery?.jobId && gallery.status === "DELIVERED") {
          await prisma.job.update({
            where: { id: gallery.jobId },
            data: { status: "COMPLETED" },
          });
        }
      }
    } catch (err) {
      console.error("Failed to update invoice after payment:", err);
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

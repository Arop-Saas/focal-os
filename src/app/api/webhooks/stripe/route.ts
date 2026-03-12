import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.workspace.updateMany({
          where: { stripeCustomerId: sub.customer as string },
          data: {
            stripeSubscriptionId: sub.id,
            stripePriceId: sub.items.data[0]?.price.id,
            subscriptionStatus: mapSubStatus(sub.status),
            subscriptionEndsAt: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.workspace.updateMany({
          where: { stripeCustomerId: sub.customer as string },
          data: {
            subscriptionStatus: "CANCELED",
            stripeSubscriptionId: null,
          },
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.subscription) {
          await prisma.workspace.updateMany({
            where: { stripeCustomerId: inv.customer as string },
            data: { subscriptionStatus: "ACTIVE" },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        await prisma.workspace.updateMany({
          where: { stripeCustomerId: inv.customer as string },
          data: { subscriptionStatus: "PAST_DUE" },
        });
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "payment" && session.metadata?.invoiceId) {
          // Payment for a Focal OS invoice
          await prisma.invoice.update({
            where: { id: session.metadata.invoiceId },
            data: {
              status: "PAID",
              amountPaid: (session.amount_total ?? 0) / 100,
              amountDue: 0,
              paidAt: new Date(),
              stripePaymentIntentId: session.payment_intent as string,
            },
          });

          await prisma.payment.create({
            data: {
              invoiceId: session.metadata.invoiceId,
              amount: (session.amount_total ?? 0) / 100,
              method: "CARD",
              status: "SUCCEEDED",
              stripePaymentId: session.payment_intent as string,
              paidAt: new Date(),
            },
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function mapSubStatus(status: Stripe.Subscription.Status) {
  const map: Record<string, string> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    paused: "PAUSED",
    incomplete: "PAST_DUE",
    incomplete_expired: "CANCELED",
    unpaid: "PAST_DUE",
  };
  return (map[status] ?? "ACTIVE") as any;
}

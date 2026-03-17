/**
 * Platform Stripe webhook — handles subscription lifecycle for FocalOS billing.
 *
 * Register this URL in your Stripe Dashboard:
 *   https://yourapp.com/api/webhooks/stripe-platform
 *
 * Events to enable:
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_failed
 *   - invoice.payment_succeeded
 */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIER_MAP: Record<string, "STARTER" | "PRO" | "AGENCY"> = {
  STARTER: "STARTER",
  PRO: "PRO",
  AGENCY: "AGENCY",
};

const GRACE_PERIOD_DAYS = 3;

function getPlatformStripe() {
  const key = process.env.STRIPE_PLATFORM_SECRET_KEY;
  if (!key) throw new Error("STRIPE_PLATFORM_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_PLATFORM_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (webhookSecret && sig) {
    const stripe = getPlatformStripe();
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("[platform-webhook] Signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  try {
    switch (event.type) {

      // ── Subscription started (after checkout) ──────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const workspaceId = session.metadata?.workspaceId;
        const tier = session.metadata?.tier as string | undefined;
        const subscriptionId = session.subscription as string;

        if (!workspaceId) {
          console.warn("[platform-webhook] checkout.session.completed: no workspaceId in metadata");
          break;
        }

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            stripeSubscriptionId: subscriptionId,
            stripePriceId: null, // will be set by subscription.updated event
            subscriptionStatus: "ACTIVE",
            subscriptionTier: tier ? (TIER_MAP[tier] ?? null) : null,
            gracePeriodEndsAt: null,
            trialEndsAt: null, // trial is over
          },
        });

        console.log(`[platform-webhook] Workspace ${workspaceId} subscribed (${tier})`);
        break;
      }

      // ── Subscription updated (plan change, renewal, reactivation) ──────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const workspaceId = sub.metadata?.workspaceId;
        if (!workspaceId) break;

        const priceId = sub.items.data[0]?.price.id ?? null;
        const tier = sub.metadata?.tier as string | undefined;

        let status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "PAUSED" | "TRIALING" | "GRACE_PERIOD" = "ACTIVE";
        if (sub.status === "past_due") status = "PAST_DUE";
        else if (sub.status === "canceled") status = "CANCELED";
        else if (sub.status === "paused") status = "PAUSED";
        else if (sub.status === "trialing") status = "TRIALING";

        const subscriptionEndsAt = sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null;

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            stripePriceId: priceId,
            subscriptionStatus: status,
            subscriptionTier: tier ? (TIER_MAP[tier] ?? null) : undefined,
            subscriptionEndsAt,
            gracePeriodEndsAt: status === "ACTIVE" ? null : undefined,
          },
        });

        console.log(`[platform-webhook] Workspace ${workspaceId} subscription updated → ${status}`);
        break;
      }

      // ── Subscription cancelled ─────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const workspaceId = sub.metadata?.workspaceId;
        if (!workspaceId) break;

        // Enter grace period — 3 days to re-subscribe before hard lock
        const gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            subscriptionStatus: "GRACE_PERIOD",
            gracePeriodEndsAt,
            stripeSubscriptionId: null,
          },
        });

        console.log(`[platform-webhook] Workspace ${workspaceId} cancelled → grace period until ${gracePeriodEndsAt.toISOString()}`);
        break;
      }

      // ── Payment failed → enter grace period ───────────────────────────────
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        if (!customerId) break;

        const workspace = await prisma.workspace.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true },
        });
        if (!workspace) break;

        const gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

        await prisma.workspace.update({
          where: { id: workspace.id },
          data: {
            subscriptionStatus: "GRACE_PERIOD",
            gracePeriodEndsAt,
          },
        });

        console.log(`[platform-webhook] Payment failed for workspace ${workspace.id} → grace period`);
        break;
      }

      // ── Payment recovered ──────────────────────────────────────────────────
      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        // Only handle subscription invoices (not one-off)
        if (!inv.subscription) break;

        const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        if (!customerId) break;

        const workspace = await prisma.workspace.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true, subscriptionStatus: true },
        });
        if (!workspace) break;

        // Only update if they were in a non-active state (payment recovery)
        if (workspace.subscriptionStatus !== "ACTIVE") {
          await prisma.workspace.update({
            where: { id: workspace.id },
            data: {
              subscriptionStatus: "ACTIVE",
              gracePeriodEndsAt: null,
            },
          });
          console.log(`[platform-webhook] Payment recovered for workspace ${workspace.id} → ACTIVE`);
        }
        break;
      }

      default:
        // Ignore other events
        break;
    }
  } catch (err) {
    console.error("[platform-webhook] Handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

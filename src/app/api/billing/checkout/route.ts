/**
 * Platform billing checkout — creates a Stripe Subscription checkout session.
 * Uses YOUR Stripe account (STRIPE_PLATFORM_SECRET_KEY), not the workspace's own keys.
 *
 * POST body: { tier: "STARTER"|"PRO"|"AGENCY" }
 * Price IDs are resolved server-side from STRIPE_PRICE_STARTER/PRO/AGENCY env vars.
 */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";

function getPlatformStripe() {
  const key = process.env.STRIPE_PLATFORM_SECRET_KEY;
  if (!key) throw new Error("STRIPE_PLATFORM_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as { tier?: string };
    const { tier } = body;

    if (!tier) {
      return NextResponse.json({ error: "Missing tier" }, { status: 400 });
    }

    // Resolve price ID server-side — never expose these to the client
    const PRICE_IDS: Record<string, string | undefined> = {
      STARTER: process.env.STRIPE_PRICE_STARTER,
      PRO:     process.env.STRIPE_PRICE_PRO,
      AGENCY:  process.env.STRIPE_PRICE_AGENCY,
    };
    const priceId = PRICE_IDS[tier];
    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID for ${tier} plan is not configured. Add STRIPE_PRICE_${tier} to your env vars.` },
        { status: 500 }
      );
    }

    // Get user + workspace
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: {
        workspaces: {
          where: { role: "OWNER" },
          include: { workspace: { select: { id: true, name: true, email: true, stripeCustomerId: true, slug: true } } },
          take: 1,
        },
      },
    });

    if (!user || !user.workspaces[0]) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const workspace = user.workspaces[0].workspace;
    const stripe = getPlatformStripe();

    // Reuse existing Stripe customer or create one
    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: workspace.name,
        email: workspace.email ?? user.email ?? undefined,
        metadata: { workspaceId: workspace.id, workspaceSlug: workspace.slug },
      });
      customerId = customer.id;
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        workspaceId: workspace.id,
        tier,
      },
      subscription_data: {
        metadata: { workspaceId: workspace.id, tier },
        trial_end: "now", // Trial was handled by us, not Stripe
      },
      success_url: `${APP_URL}/billing?subscribed=1`,
      cancel_url:  `${APP_URL}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Platform billing checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}

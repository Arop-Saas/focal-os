/**
 * Stripe Customer Portal — lets subscribers manage their subscription,
 * update payment method, download invoices, or cancel.
 */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = process.env.STRIPE_PLATFORM_SECRET_KEY;
    if (!key) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: {
        workspaces: {
          where: { role: "OWNER" },
          include: { workspace: { select: { stripeCustomerId: true } } },
          take: 1,
        },
      },
    });

    const customerId = user?.workspaces[0]?.workspace?.stripeCustomerId;
    if (!customerId) {
      return NextResponse.json({ error: "No billing account found. Please subscribe first." }, { status: 400 });
    }

    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("Billing portal error:", err);
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}

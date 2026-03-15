import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json();
    if (!slug) return NextResponse.json({ error: "Missing gallery slug" }, { status: 400 });

    // Find gallery → job → invoice → workspace
    const gallery = await prisma.gallery.findUnique({
      where: { slug },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            brandColor: true,
            stripeSecretKey: true,
          },
        },
        job: {
          select: {
            propertyAddress: true,
            invoice: {
              select: {
                id: true,
                status: true,
                amountDue: true,
                totalAmount: true,
                invoiceNumber: true,
              },
            },
          },
        },
      },
    });

    if (!gallery) return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    if (!gallery.job.invoice) return NextResponse.json({ error: "No invoice for this job" }, { status: 400 });
    if (gallery.job.invoice.status === "PAID") return NextResponse.json({ error: "Already paid" }, { status: 400 });
    if (!gallery.workspace.stripeSecretKey) {
      return NextResponse.json({ error: "Studio has not connected Stripe yet" }, { status: 400 });
    }

    const stripe = new Stripe(gallery.workspace.stripeSecretKey, { apiVersion: "2024-06-20" });
    const invoice = gallery.job.invoice;
    const amountCents = Math.round(invoice.amountDue * 100);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://focal-os.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `${gallery.workspace.name} — ${gallery.job.propertyAddress}`,
              description: `Invoice #${invoice.invoiceNumber}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoiceId: invoice.id,
        gallerySlug: slug,
        workspaceId: gallery.workspace.id,
      },
      success_url: `${baseUrl}/g/${slug}?paid=1`,
      cancel_url:  `${baseUrl}/g/${slug}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}

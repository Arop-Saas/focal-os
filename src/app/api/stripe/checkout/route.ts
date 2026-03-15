import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://focal-os.vercel.app";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, invoiceId: directInvoiceId } = body as { slug?: string; invoiceId?: string };

    // ── Path 1: Gallery-based checkout (from the public gallery page) ──────────
    if (slug) {
      const gallery = await prisma.gallery.findUnique({
        where: { slug },
        include: {
          workspace: {
            select: { id: true, name: true, brandColor: true, stripeSecretKey: true },
          },
          job: {
            select: {
              propertyAddress: true,
              invoice: {
                select: { id: true, status: true, amountDue: true, invoiceNumber: true },
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

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "cad",
            product_data: {
              name: `${gallery.workspace.name} — ${gallery.job.propertyAddress}`,
              description: `Invoice #${invoice.invoiceNumber}`,
            },
            unit_amount: Math.round(invoice.amountDue * 100),
          },
          quantity: 1,
        }],
        metadata: { invoiceId: invoice.id, gallerySlug: slug, workspaceId: gallery.workspace.id },
        success_url: `${baseUrl}/g/${slug}?paid=1`,
        cancel_url:  `${baseUrl}/g/${slug}`,
      });

      return NextResponse.json({ url: session.url });
    }

    // ── Path 2: Invoice-based checkout (from the client portal) ────────────────
    if (directInvoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: directInvoiceId },
        include: {
          workspace: {
            select: { id: true, name: true, slug: true, stripeSecretKey: true },
          },
          job: {
            select: {
              propertyAddress: true,
              gallery: { select: { slug: true } },
            },
          },
        },
      });

      if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      if (invoice.status === "PAID") return NextResponse.json({ error: "Already paid" }, { status: 400 });
      if (!invoice.workspace.stripeSecretKey) {
        return NextResponse.json({ error: "Studio has not connected Stripe yet" }, { status: 400 });
      }

      const stripe = new Stripe(invoice.workspace.stripeSecretKey, { apiVersion: "2024-06-20" });
      const gallerySlug = invoice.job?.gallery?.slug ?? null;

      // Return URL: back to portal invoices after payment
      const portalBase = `${baseUrl}/portal/${invoice.workspace.slug}`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "cad",
            product_data: {
              name: `${invoice.workspace.name} — ${invoice.job?.propertyAddress ?? "Services"}`,
              description: `Invoice #${invoice.invoiceNumber}`,
            },
            unit_amount: Math.round(invoice.amountDue * 100),
          },
          quantity: 1,
        }],
        metadata: {
          invoiceId: invoice.id,
          ...(gallerySlug ? { gallerySlug } : {}),
          workspaceId: invoice.workspace.id,
        },
        success_url: `${portalBase}/invoices?paid=1`,
        cancel_url:  `${portalBase}/invoices`,
      });

      return NextResponse.json({ url: session.url });
    }

    return NextResponse.json({ error: "Missing slug or invoiceId" }, { status: 400 });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}

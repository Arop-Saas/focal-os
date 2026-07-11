/**
 * POST /api/stripe/checkout — client payment checkout (core/money).
 *
 * Accepts exactly one of:
 *  - { slug }               public gallery page (pay-to-unlock)
 *  - { payToken, source }   public /pay page (tokenized — invoice IDs are
 *                           never accepted from the public internet, R9)
 *  - { invoiceId, source }  authenticated client-portal page
 *
 * Uses Stripe Connect when the studio is connected (platform key +
 * stripeAccount), falling back to the legacy pasted key. Currency comes from
 * the workspace — nothing is hardcoded (R12).
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { stripeFor, stripeCurrency } from "@/lib/money/stripe";
import { cookies } from "next/headers";
import { verifyPortalToken, PORTAL_COOKIE } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";

const WORKSPACE_SELECT = {
  id: true, name: true, slug: true, currency: true,
  stripeAccountId: true, stripeSecretKey: true,
} as const;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: string;
      payToken?: string;
      invoiceId?: string;
      source?: string;
    };

    let invoice:
      | {
          id: string; invoiceNumber: string; status: string; amountDue: number;
          payToken: string | null;
          workspace: { id: string; name: string; slug: string; currency: string; stripeAccountId: string | null; stripeSecretKey: string | null };
          job: { propertyAddress: string; gallery: { slug: string } | null } | null;
        }
      | null = null;
    let gallerySlug: string | null = null;

    if (body.slug) {
      // ── Public gallery checkout ─────────────────────────────────────────
      const gallery = await prisma.gallery.findUnique({
        where: { slug: body.slug },
        select: {
          slug: true,
          job: {
            select: {
              propertyAddress: true,
              invoice: {
                select: {
                  id: true, invoiceNumber: true, status: true, amountDue: true, payToken: true,
                  workspace: { select: WORKSPACE_SELECT },
                },
              },
            },
          },
        },
      });
      if (!gallery) return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
      if (!gallery.job?.invoice) return NextResponse.json({ error: "No invoice for this job" }, { status: 400 });
      gallerySlug = gallery.slug;
      invoice = { ...gallery.job.invoice, job: { propertyAddress: gallery.job.propertyAddress, gallery: { slug: gallery.slug } } };
    } else if (body.payToken) {
      // ── Public tokenized pay page ───────────────────────────────────────
      const inv = await prisma.invoice.findUnique({
        where: { payToken: body.payToken },
        select: {
          id: true, invoiceNumber: true, status: true, amountDue: true, payToken: true,
          workspace: { select: WORKSPACE_SELECT },
          job: { select: { propertyAddress: true, gallery: { select: { slug: true } } } },
        },
      });
      if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      invoice = inv;
    } else if (body.invoiceId) {
      // ── Authenticated portal checkout — session client must own it ─────
      const token = cookies().get(PORTAL_COOKIE)?.value;
      const session = token ? verifyPortalToken(token) : null;
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const inv = await prisma.invoice.findFirst({
        where: { id: body.invoiceId, clientId: session.clientId },
        select: {
          id: true, invoiceNumber: true, status: true, amountDue: true, payToken: true,
          workspace: { select: WORKSPACE_SELECT },
          job: { select: { propertyAddress: true, gallery: { select: { slug: true } } } },
        },
      });
      if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      invoice = inv;
    } else {
      return NextResponse.json({ error: "Missing slug, payToken or invoiceId" }, { status: 400 });
    }

    if (invoice.status === "PAID") return NextResponse.json({ error: "Already paid" }, { status: 400 });
    if (invoice.amountDue <= 0) return NextResponse.json({ error: "Nothing due" }, { status: 400 });

    const { stripe, requestOptions, mode } = stripeFor(invoice.workspace);
    if (mode === "none") {
      return NextResponse.json({ error: "Studio has not connected Stripe yet" }, { status: 400 });
    }

    const isPayPage = body.source === "pay-page" || !!body.payToken;
    const payUrl = `${baseUrl}/pay/${invoice.payToken ?? invoice.id}`;
    const successUrl = body.slug
      ? `${baseUrl}/g/${gallerySlug}?paid=1`
      : isPayPage
      ? `${payUrl}?paid=1`
      : `${baseUrl}/portal/${invoice.workspace.slug}/invoices?paid=1`;
    const cancelUrl = body.slug
      ? `${baseUrl}/g/${gallerySlug}`
      : isPayPage
      ? payUrl
      : `${baseUrl}/portal/${invoice.workspace.slug}/invoices`;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: stripeCurrency(invoice.workspace.currency),
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
          workspaceId: invoice.workspace.id,
          ...(gallerySlug ? { gallerySlug } : {}),
          expectedAmount: String(Math.round(invoice.amountDue * 100)),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      requestOptions
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe/checkout error:", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}

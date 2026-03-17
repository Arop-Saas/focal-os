import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { CheckCircle, Receipt } from "lucide-react";
import { DirectPayButton } from "./DirectPayButton";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ paid?: string }>;
};

export default async function DirectPayPage({ params, searchParams }: Props) {
  const { invoiceId } = await params;
  const { paid } = await searchParams;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      workspace: {
        select: {
          name: true,
          logoUrl: true,
          brandColor: true,
          stripeSecretKey: true,
          slug: true,
        },
      },
      client: {
        select: { firstName: true, lastName: true, email: true },
      },
      job: {
        select: { propertyAddress: true, jobNumber: true },
      },
      lineItems: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!invoice) return notFound();

  const { workspace } = invoice;
  const brandColor = workspace.brandColor ?? "#1B4F9E";
  const hasStripe = !!workspace.stripeSecretKey;
  const isPaid = invoice.status === "PAID";
  const isVoid = invoice.status === "VOID";
  const canPay = hasStripe && !isPaid && !isVoid && invoice.amountDue > 0;
  const justPaid = paid === "1";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-10 pb-16 px-4">
      {/* Card */}
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Branded header */}
        <div className="px-8 py-6" style={{ background: brandColor }}>
          {workspace.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={workspace.logoUrl}
              alt={workspace.name}
              className="h-9 object-contain mb-1"
            />
          ) : (
            <p className="text-white font-bold text-lg mb-1">{workspace.name}</p>
          )}
          <p className="text-white/70 text-sm">Invoice #{invoice.invoiceNumber}</p>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-5">

          {/* Success banner */}
          {justPaid && (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-4">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Payment received — thank you!</p>
                <p className="text-xs text-green-600 mt-0.5">
                  A receipt has been sent to your email.
                </p>
              </div>
            </div>
          )}

          {/* Property / client */}
          <div>
            {invoice.job?.propertyAddress && (
              <p className="font-semibold text-gray-900">{invoice.job.propertyAddress}</p>
            )}
            {invoice.client && (
              <p className="text-sm text-gray-500 mt-0.5">
                {invoice.client.firstName} {invoice.client.lastName}
                {invoice.client.email ? ` · ${invoice.client.email}` : ""}
              </p>
            )}
          </div>

          {/* Dates */}
          <div className="flex gap-6 text-sm">
            {invoice.issuedAt && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Issued</p>
                <p className="text-gray-700">{format(new Date(invoice.issuedAt), "MMM d, yyyy")}</p>
              </div>
            )}
            {invoice.dueAt && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Due</p>
                <p className="text-gray-700">{format(new Date(invoice.dueAt), "MMM d, yyyy")}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">Description</th>
                  <th className="text-right text-xs font-medium text-gray-400 px-4 py-2.5">Qty</th>
                  <th className="text-right text-xs font-medium text-gray-400 px-4 py-2.5">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, i) => (
                  <tr key={item.id} className={i < invoice.lineItems.length - 1 ? "border-b border-gray-50" : ""}>
                    <td className="px-4 py-3 text-gray-700">{item.description}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-800 font-medium">
                      ${item.totalPrice.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>${invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>−${invoice.discountAmount.toFixed(2)}</span>
              </div>
            )}
            {invoice.taxAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax ({invoice.taxRate}%)</span>
                <span>${invoice.taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>${invoice.totalAmount.toFixed(2)} CAD</span>
            </div>
            {invoice.amountPaid > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Paid</span>
                <span>−${invoice.amountPaid.toFixed(2)}</span>
              </div>
            )}
            {!isPaid && invoice.amountDue > 0 && (
              <div className="flex justify-between text-base font-bold text-amber-600 pt-1">
                <span>Balance due</span>
                <span>${invoice.amountDue.toFixed(2)} CAD</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}

          {/* Pay button */}
          {canPay && !justPaid && (
            <DirectPayButton invoiceId={invoice.id} brandColor={brandColor} />
          )}

          {/* Already paid state */}
          {(isPaid || justPaid) && (
            <div className="flex items-center gap-2.5 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-700">This invoice has been paid</p>
            </div>
          )}

          {/* Void state */}
          {isVoid && (
            <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <Receipt className="w-4 h-4 text-gray-400 shrink-0" />
              <p className="text-sm font-medium text-gray-500">This invoice has been voided</p>
            </div>
          )}

          {/* No Stripe configured */}
          {!hasStripe && !isPaid && !isVoid && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-700">
                Online payment is not available yet. Please contact{" "}
                <span className="font-semibold">{workspace.name}</span> to arrange payment.
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-gray-400 text-xs mt-5">
        Powered by <span className="font-medium text-gray-500">FocalOS</span>
      </p>
    </div>
  );
}

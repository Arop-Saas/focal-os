import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { AutoPrint } from "@/components/invoices/auto-print";
import { PrintButton } from "@/components/invoices/print-button";

export const dynamic = "force-dynamic";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD: "Card",
  ACH: "ACH bank transfer",
  CHECK: "Check",
  CASH: "Cash",
  WIRE: "Wire transfer",
  OTHER: "Other",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default async function InvoicePrintPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });
  if (!user) redirect("/login");

  const workspaceId = user.workspaces[0]?.workspace.id;
  const workspace = user.workspaces[0]?.workspace;

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, workspaceId },
    include: {
      client: true,
      job: { select: { jobNumber: true, propertyAddress: true, propertyCity: true, propertyState: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!invoice) notFound();

  const brandColor = workspace?.brandColor ?? "#1B4F9E";

  return (
    <>
      {/* Auto-trigger print dialog */}
      <AutoPrint />

      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Invoice {invoice.invoiceNumber} — {invoice.client.firstName} {invoice.client.lastName}</title>
          <style dangerouslySetInnerHTML={{ __html: `
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              font-size: 13px;
              color: #1e293b;
              background: #fff;
            }
            .page { max-width: 720px; margin: 0 auto; padding: 40px 40px 60px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 2px solid ${brandColor}; }
            .brand-name { font-size: 22px; font-weight: 700; color: ${brandColor}; letter-spacing: -0.5px; }
            .brand-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }
            .invoice-meta { text-align: right; }
            .invoice-number { font-size: 18px; font-weight: 700; color: #0f172a; }
            .invoice-meta p { font-size: 12px; color: #64748b; margin-top: 4px; }
            .invoice-meta .status-badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #f0fdf4; color: #16a34a; margin-top: 8px; border: 1px solid #bbf7d0; }
            .invoice-meta .status-overdue { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
            .invoice-meta .status-draft { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }
            .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
            .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 8px; }
            .party-name { font-weight: 600; color: #0f172a; font-size: 14px; }
            .party-info { color: #475569; font-size: 12px; line-height: 1.7; margin-top: 3px; }
            .line-items { width: 100%; border-collapse: collapse; margin-bottom: 0; }
            .line-items thead tr { border-bottom: 1px solid #e2e8f0; }
            .line-items thead th { padding: 10px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; text-align: left; }
            .line-items thead th:last-child, .line-items thead th:nth-child(2), .line-items thead th:nth-child(3) { text-align: right; }
            .line-items tbody tr { border-bottom: 1px solid #f1f5f9; }
            .line-items tbody tr:last-child { border-bottom: none; }
            .line-items td { padding: 11px 12px; color: #334155; vertical-align: top; }
            .line-items td.amount { text-align: right; font-weight: 500; color: #0f172a; }
            .line-items td.qty, .line-items td.unit { text-align: right; color: #64748b; }
            .line-items-wrapper { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
            .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
            .totals-box { width: 260px; }
            .total-row { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; color: #475569; }
            .total-row.bold { font-weight: 700; font-size: 15px; color: #0f172a; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 4px; }
            .total-row.balance { color: #dc2626; font-weight: 700; font-size: 15px; }
            .total-row.paid { color: #16a34a; }
            .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 10px; }
            .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px; font-size: 12px; }
            .payment-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
            .payment-table th { text-align: left; font-weight: 600; color: #64748b; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
            .payment-table th:last-child { text-align: right; }
            .payment-table td { padding: 7px 0; color: #334155; border-bottom: 1px solid #f1f5f9; }
            .payment-table td:last-child { text-align: right; color: #16a34a; font-weight: 600; }
            .footer { text-align: center; margin-top: 48px; padding-top: 20px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 11px; }
            /* Print controls — visible on screen, hidden when printing */
            .print-controls { position: fixed; bottom: 24px; right: 24px; display: flex; gap: 10px; z-index: 100; }
            .btn-print { background: ${brandColor}; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
            .btn-close { background: #fff; color: #475569; border: 1px solid #e2e8f0; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; text-decoration: none; display: inline-block; }
            @media print {
              .print-controls { display: none !important; }
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              .page { padding: 20px 24px; }
            }
          ` }} />
        </head>
        <body>
          {/* Floating print + close buttons */}
          <div className="print-controls">
            <a href={`/invoices/${params.id}`} className="btn-close">← Back</a>
            <PrintButton brandColor={brandColor} />
          </div>

          <div className="page">
            {/* Header */}
            <div className="header">
              <div>
                <div className="brand-name">{workspace?.name ?? "Studio"}</div>
                <div className="brand-sub">Real Estate Photography</div>
                {workspace?.email && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{workspace.email}</div>}
              </div>
              <div className="invoice-meta">
                <div className="invoice-number">Invoice {invoice.invoiceNumber}</div>
                {invoice.issuedAt && <p>Issued {format(new Date(invoice.issuedAt), "MMMM d, yyyy")}</p>}
                {invoice.dueAt && <p>Due {format(new Date(invoice.dueAt), "MMMM d, yyyy")}</p>}
                <div className={`status-badge ${invoice.status === "OVERDUE" ? "status-overdue" : invoice.status === "DRAFT" ? "status-draft" : ""}`}>
                  {invoice.status}
                </div>
              </div>
            </div>

            {/* Bill to / From */}
            <div className="parties">
              <div>
                <div className="party-label">Bill To</div>
                <div className="party-name">{invoice.client.firstName} {invoice.client.lastName}</div>
                <div className="party-info">
                  {invoice.client.company && <>{invoice.client.company}<br /></>}
                  {invoice.client.email}<br />
                  {invoice.client.phone}
                </div>
              </div>
              {invoice.job && (
                <div>
                  <div className="party-label">Property</div>
                  <div className="party-name">{invoice.job.propertyAddress}</div>
                  <div className="party-info">
                    {[invoice.job.propertyCity, invoice.job.propertyState].filter(Boolean).join(", ")}<br />
                    Job #{invoice.job.jobNumber}
                  </div>
                </div>
              )}
            </div>

            {/* Line items */}
            <div className="line-items-wrapper">
              <table className="line-items">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td className="qty">{item.quantity}</td>
                      <td className="unit">{formatCurrency(item.unitPrice)}</td>
                      <td className="amount">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="totals">
              <div className="totals-box">
                <div className="total-row">
                  <span>Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.taxAmount > 0 && (
                  <div className="total-row">
                    <span>Tax ({invoice.taxRate}%)</span>
                    <span>{formatCurrency(invoice.taxAmount)}</span>
                  </div>
                )}
                {invoice.discountAmount > 0 && (
                  <div className="total-row">
                    <span>Discount</span>
                    <span style={{ color: "#dc2626" }}>−{formatCurrency(invoice.discountAmount)}</span>
                  </div>
                )}
                <div className="total-row bold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.totalAmount)}</span>
                </div>
                {invoice.amountPaid > 0 && (
                  <div className="total-row paid">
                    <span>Amount Paid</span>
                    <span>−{formatCurrency(invoice.amountPaid)}</span>
                  </div>
                )}
                {invoice.amountDue > 0 && (
                  <div className="total-row balance">
                    <span>Balance Due</span>
                    <span>{formatCurrency(invoice.amountDue)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <>
                <div className="section-label">Notes</div>
                <div className="notes-box">{invoice.notes}</div>
              </>
            )}

            {/* Payment history */}
            {invoice.payments.length > 0 && (
              <>
                <div className="section-label">Payment History</div>
                <table className="payment-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.paidAt ? format(new Date(p.paidAt), "MMMM d, yyyy") : "—"}</td>
                        <td>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</td>
                        <td>{formatCurrency(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Footer */}
            <div className="footer">
              <p>{workspace?.name} · Thank you for your business.</p>
              {workspace?.email && <p style={{ marginTop: 4 }}>Questions? {workspace.email}</p>}
            </div>
          </div>
        </body>
      </html>
    </>
  );
}

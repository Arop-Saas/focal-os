"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import { Check, Image as ImageIcon, Loader2, Send } from "lucide-react";

/**
 * Deliver — the one delivery action. Opens a pre-flight modal: the delivery
 * email (subject / message / CC) is editable before anything sends, plus
 * final options (silent delivery, mark paid). Stays available after delivery
 * for re-delivery.
 */
export function DeliverButton({ jobId, delivered }: { jobId: string; delivered: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          delivered
            ? "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            : "bg-blue-600 text-white hover:bg-blue-700"
        )}
      >
        <Send className="h-3.5 w-3.5" /> {delivered ? "Re-deliver" : "Deliver"}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <DeliverModal jobId={jobId} delivered={delivered} onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} />,
        document.body
      )}
    </>
  );
}

function DeliverModal({
  jobId,
  delivered,
  onClose,
  onDone,
}: {
  jobId: string;
  delivered: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const preview = trpc.jobs.deliveryPreview.useQuery({ jobId });

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [cc, setCc] = useState("");
  const [silent, setSilent] = useState(false);
  const [markPaid, setMarkPaid] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (preview.data && !seeded) {
      setSubject(preview.data.subject);
      setMessage(preview.data.message);
      setCc(preview.data.defaultCc.join(", "));
      if (!preview.data.to) setSilent(true); // no client — nothing to email
      setSeeded(true);
    }
  }, [preview.data, seeded]);

  const deliver = trpc.jobs.deliver.useMutation({ onSuccess: onDone });

  const submit = () => {
    if (deliver.isPending) return;
    const ccList = cc
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => /^\S+@\S+\.\S+$/.test(e));
    deliver.mutate({
      jobId,
      silent,
      subject: subject.trim() || undefined,
      message: message.trim() || undefined,
      cc: ccList,
      markPaid,
    });
  };

  const p = preview.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900">{delivered ? "Re-deliver order" : "Deliver order"}</h2>
          </div>
          <button onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-600">×</button>
        </div>

        {!p ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {/* Pre-flight summary */}
            <div className="flex flex-wrap gap-2 text-[12px]">
              <span className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-gray-600">
                <ImageIcon className="h-3 w-3 text-gray-400" /> {p.mediaCount} file{p.mediaCount !== 1 ? "s" : ""} on the listing
              </span>
              {p.amountDue > 0 ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                  {formatCurrency(p.amountDue)} outstanding{p.invoiceNumber ? ` on #${p.invoiceNumber}` : ""}
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  <Check className="h-3 w-3" /> Paid in full
                </span>
              )}
            </div>
            {!p.hasGallery && (
              <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-800">
                This order has no listing yet — the email will link the client portal instead of a gallery.
              </p>
            )}
            {p.mediaCount === 0 && p.hasGallery && (
              <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-800">
                Nothing is uploaded to the listing yet — the client will see an empty gallery.
              </p>
            )}

            {/* Email */}
            <div className={cn("space-y-3", silent && "pointer-events-none opacity-40")}>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
                <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {p.to ?? <span className="italic text-amber-600">No client on this order — silent delivery only</span>}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">CC <span className="font-normal text-gray-400">(comma-separated)</span></label>
                <input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="second.client@email.com"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed focus:border-blue-400 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-400">The gallery link button is added automatically below your message.</p>
              </div>
            </div>

            {/* Final options */}
            <div className="space-y-2.5 border-t border-gray-100 pt-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={silent} disabled={!p.to} onChange={(e) => setSilent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 disabled:opacity-40" />
                <span className="text-[13px] text-gray-700">
                  Deliver silently
                  <span className="block text-[11px] text-gray-400">Available on the client portal — no email is sent.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={markPaid}
                  onChange={(e) => setMarkPaid(e.target.checked)}
                  disabled={p.amountDue <= 0}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 disabled:opacity-40"
                />
                <span className={cn("text-[13px] text-gray-700", p.amountDue <= 0 && "opacity-40")}>
                  Mark order as paid
                  <span className="block text-[11px] text-gray-400">
                    {p.amountDue > 0 ? `Records ${formatCurrency(p.amountDue)} as received and unlocks downloads.` : "Nothing outstanding."}
                  </span>
                </span>
              </label>
              <label className="flex cursor-not-allowed items-start gap-2.5 opacity-50">
                <input type="checkbox" disabled className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                <span className="text-[13px] text-gray-700">
                  Enable marketing materials
                  <span className="block text-[11px] text-gray-400">Property websites, brochures, flyers — coming soon.</span>
                </span>
              </label>
            </div>

            {deliver.error && <p className="text-xs text-red-600">{deliver.error.message}</p>}
          </div>
        )}

        <div className="flex gap-3 border-t p-5">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!p || deliver.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {deliver.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {silent ? "Deliver silently" : "Send & deliver"}
          </button>
        </div>
      </div>
    </div>
  );
}

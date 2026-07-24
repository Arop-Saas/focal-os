"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Loader2, Send } from "lucide-react";

/**
 * "Deliver" — marks the order delivered (jobs.update → DELIVERED, which runs
 * the delivery side effects: gallery release, client notification, timestamps).
 */
export function DeliverButton({ jobId, delivered }: { jobId: string; delivered: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const update = trpc.jobs.update.useMutation({
    onSuccess: () => {
      setConfirming(false);
      router.refresh();
    },
  });

  if (delivered) return null;

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        <Send className="h-3.5 w-3.5" /> Deliver
      </button>

      {confirming && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Deliver this order?</h3>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              The order is marked delivered and the client is notified. Make sure the
              listing has everything they&apos;re expecting.
            </p>
            {update.error && <p className="mb-3 text-xs text-red-600">{update.error.message}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                disabled={update.isPending}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                Not yet
              </button>
              <button
                onClick={() => update.mutate({ id: jobId, status: "DELIVERED" })}
                disabled={update.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Deliver
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

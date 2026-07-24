"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

interface JobDeleteButtonProps {
  jobId: string;
  jobNumber: string;
}

export function JobDeleteButton({ jobId, jobNumber }: JobDeleteButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  const deleteJob = trpc.jobs.delete.useMutation({
    onSuccess: () => {
      router.push("/jobs");
      router.refresh();
    },
  });

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        aria-label="Delete order"
        title="Delete order"
        className="rounded-lg border border-red-200 bg-white p-2 text-red-600 transition-colors hover:border-red-300 hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Portaled so ancestor backdrop-blur (sticky header) can't trap the fixed overlay */}
      {showConfirm && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Job</h3>
                <p className="text-sm text-gray-500">#{jobNumber}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete this job and all associated data including
              invoices, gallery, messages, and assignments. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleteJob.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteJob.mutate({ id: jobId })}
                disabled={deleteJob.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {deleteJob.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete permanently
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { X } from "lucide-react";

/** Dismisses the Needs Attention card for the current reasons — it returns
 * automatically when the reasons change. */
export function DismissAttentionButton({ jobId, attentionKey }: { jobId: string; attentionKey: string }) {
  const router = useRouter();
  const dismiss = trpc.jobs.dismissAttention.useMutation({
    onSuccess: () => router.refresh(),
  });
  return (
    <button
      onClick={() => dismiss.mutate({ jobId, key: attentionKey })}
      disabled={dismiss.isPending}
      title="Dismiss — returns if anything changes"
      className="rounded p-0.5 text-amber-400 transition-colors hover:text-amber-700"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

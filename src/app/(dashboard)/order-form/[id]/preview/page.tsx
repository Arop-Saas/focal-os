"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";

export default function OrderFormPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: workspace, isLoading: wsLoading } = api.workspace.getCurrent.useQuery();
  const { data: form, isLoading: formLoading } = api.orderForm.get.useQuery({ id });

  const isLoading = wsLoading || formLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!workspace || !form) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-gray-500">Order form not found.</p>
        <button
          onClick={() => router.push("/order-form")}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to order forms
        </button>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.scalist.io";
  const bookingUrl = `${origin}/book/${workspace.slug}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/order-form")}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Back to order forms"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Preview: {form.title}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              This is how your clients will see the booking form
            </p>
          </div>
        </div>

        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in new tab
        </a>
      </div>

      {/* Iframe preview */}
      <div className="flex-1 bg-gray-100 p-4 overflow-hidden">
        <div className="w-full h-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg border border-gray-200">
          <iframe
            src={bookingUrl}
            className="w-full h-full bg-white"
            title={`Preview: ${form.title}`}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { api } from "@/lib/trpc/client";
import { OrderFormEditor } from "./order-form-editor";
import { Loader2 } from "lucide-react";

export function OrderFormEditorWrapper({ formId }: { formId: string }) {
  // Reuse getBookingFormSettings which already returns the workspace slug
  const { data, isLoading } = api.workspace.getBookingFormSettings.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return <OrderFormEditor formId={formId} workspaceSlug={data?.slug ?? ""} />;
}

"use client";

import { api } from "@/lib/trpc/client";
import { OrderFormDesigner } from "./order-form-designer";
import { Loader2 } from "lucide-react";

export function OrderFormEditorWrapper({ formId }: { formId: string }) {
  const { data, isLoading } = api.workspace.getBookingFormSettings.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return <OrderFormDesigner formId={formId} workspaceSlug={data?.slug ?? ""} />;
}

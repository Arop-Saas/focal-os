import { Header } from "@/components/layout/header";
import { OrderFormEditorWrapper } from "@/components/order-form/order-form-editor-wrapper";

export const metadata = { title: "Edit Order Form" };

export default function OrderFormEditPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Edit Order Form"
        description="Configure fields, scheduling, and payment settings"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <OrderFormEditorWrapper formId={params.id} />
      </div>
    </div>
  );
}

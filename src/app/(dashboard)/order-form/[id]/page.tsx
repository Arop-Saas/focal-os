import { OrderFormEditorWrapper } from "@/components/order-form/order-form-editor-wrapper";

export const metadata = { title: "Order Form Designer" };

export default function OrderFormEditPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <OrderFormEditorWrapper formId={params.id} />
    </div>
  );
}

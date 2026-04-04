import { Header } from "@/components/layout/header";
import { OrderFormSettings } from "@/components/order-form/order-form-settings";

export const metadata = { title: "Order Form" };

export default function OrderFormPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Order Form"
        description="Customize the fields shown on your client-facing booking page"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <OrderFormSettings />
      </div>
    </div>
  );
}

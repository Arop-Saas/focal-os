import { Header } from "@/components/layout/header";
import { OrderFormList } from "@/components/order-form/order-form-list";

export const metadata = { title: "Order Forms" };

export default function OrderFormsPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Order Forms"
        description="Create and manage client-facing booking forms"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <OrderFormList />
      </div>
    </div>
  );
}

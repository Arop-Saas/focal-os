import { Header } from "@/components/layout/header";
import { PackagesView } from "@/components/packages/packages-view";

export const metadata = { title: "Products" };

export default async function PackagesPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Products & Services"
        description="Manage your service offerings and package bundles"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <PackagesView />
      </div>
    </div>
  );
}

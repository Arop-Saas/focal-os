import { Header } from "@/components/layout/header";
import { IntegrationsTab } from "@/components/settings/integrations-tab";

export const metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Integrations"
        description="Connect Scalist with payments, calendars, and other tools"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <IntegrationsTab />
        </div>
      </div>
    </div>
  );
}

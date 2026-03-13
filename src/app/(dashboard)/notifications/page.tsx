import { Header } from "@/components/layout/header";
import { Bell } from "lucide-react";

export const metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Notifications"
        description="Stay up to date with your workspace activity"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Empty state */}
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 mb-4">
              <Bell className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900 mb-1">
              No notifications yet
            </h3>
            <p className="text-[13px] text-gray-400 max-w-xs leading-relaxed">
              When you have new jobs, invoices, or activity in your workspace,
              notifications will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

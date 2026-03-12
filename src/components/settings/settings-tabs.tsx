"use client";

import { useState } from "react";
import { Workspace } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Settings,
  Palette,
  CreditCard,
  Bell,
} from "lucide-react";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

interface SettingsTabsProps {
  workspace: Workspace;
}

interface NotificationPreferences {
  newBooking: boolean;
  invoicePaid: boolean;
  jobCompleted: boolean;
  lowStock: boolean;
}

export function SettingsTabs({ workspace }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<"general" | "branding" | "billing" | "notifications">("general");
  const [loading, setLoading] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    newBooking: true,
    invoicePaid: true,
    jobCompleted: true,
    lowStock: false,
  });

  const handleGeneralSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    // In a real app, this would call the tRPC mutation: api.workspace.update
    // For now, just simulate the save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
  };

  const handleNotificationSave = async () => {
    setLoading(true);
    // In a real app, this would persist notification preferences
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
  };

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "branding", label: "Branding", icon: Palette },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "notifications", label: "Notifications", icon: Bell },
  ] as const;

  return (
    <div className="p-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors -mb-px",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="max-w-2xl">
        {/* GENERAL TAB */}
        {activeTab === "general" && (
          <form onSubmit={handleGeneralSave} className="space-y-6">
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Workspace Information</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workspace Name
                </label>
                <Input
                  type="text"
                  defaultValue={workspace.name}
                  className="w-full"
                  placeholder="My Studio"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <Input
                    type="tel"
                    defaultValue={workspace.phone || ""}
                    className="w-full"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    defaultValue={workspace.email || ""}
                    className="w-full"
                    placeholder="contact@studio.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <Input
                  type="url"
                  defaultValue={workspace.website || ""}
                  className="w-full"
                  placeholder="https://mystudio.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timezone
                  </label>
                  <select
                    defaultValue={workspace.timezone}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency
                  </label>
                  <select
                    defaultValue={workspace.currency}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CURRENCIES.map((curr) => (
                      <option key={curr} value={curr}>
                        {curr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Tax Rate (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={workspace.defaultTaxRate}
                  className="w-full"
                  placeholder="0"
                />
              </div>

              <Button disabled={loading} className="w-full">
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}

        {/* BRANDING TAB */}
        {activeTab === "branding" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Brand Settings</h3>

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo
                </label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                  <p className="text-sm text-gray-600">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG up to 2MB
                  </p>
                </div>
              </div>

              {/* Brand Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    defaultValue={workspace.brandColor || "#1B4F9E"}
                    className="h-12 w-16 rounded border cursor-pointer"
                  />
                  <Input
                    type="text"
                    defaultValue={workspace.brandColor || "#1B4F9E"}
                    className="flex-1"
                    placeholder="#1B4F9E"
                  />
                </div>
              </div>

              {/* Invoice Settings */}
              <div className="pt-4 border-t space-y-4">
                <h4 className="font-medium text-gray-900">Invoice Settings</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Prefix
                  </label>
                  <Input
                    type="text"
                    defaultValue={workspace.invoicePrefix}
                    className="w-full"
                    placeholder="INV"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Next Invoice Number
                  </label>
                  <Input
                    type="number"
                    defaultValue={workspace.invoiceNextNumber}
                    className="w-full"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-incremented with each invoice
                  </p>
                </div>
              </div>

              <Button className="w-full">Save Changes</Button>
            </div>
          </div>
        )}

        {/* BILLING TAB */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Billing & Subscription</h3>

              {/* Current Plan */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-blue-900">Current Plan</p>
                  <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                    {workspace.subscriptionStatus}
                  </span>
                </div>
                <p className="text-xs text-blue-700">
                  {workspace.subscriptionStatus === "TRIALING" && workspace.trialEndsAt
                    ? `Trial ends on ${new Date(workspace.trialEndsAt).toLocaleDateString()}`
                    : "Your subscription is active"}
                </p>
              </div>

              {/* Plan Features */}
              <div className="pt-4 border-t space-y-3">
                <p className="font-medium text-gray-900 text-sm">Plan Features</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Unlimited galleries
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Advanced reporting
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Team collaboration
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    API access
                  </li>
                </ul>
              </div>

              <Button variant="outline" className="w-full">
                Upgrade Plan
              </Button>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>

              <div className="space-y-4">
                {/* New Booking */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Email on new booking
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications when a new booking is created
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.newBooking}
                    onChange={(e) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        newBooking: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                </div>

                {/* Invoice Paid */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Email when invoice is paid
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications for successful invoice payments
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.invoicePaid}
                    onChange={(e) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        invoicePaid: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                </div>

                {/* Job Completed */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Email when job is completed
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications when a job status changes to completed
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.jobCompleted}
                    onChange={(e) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        jobCompleted: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                </div>

                {/* Low Stock Alert */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Low stock alerts
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications when inventory is running low
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.lowStock}
                    onChange={(e) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        lowStock: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              <Button
                disabled={loading}
                onClick={handleNotificationSave}
                className="w-full"
              >
                {loading ? "Saving..." : "Save Preferences"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

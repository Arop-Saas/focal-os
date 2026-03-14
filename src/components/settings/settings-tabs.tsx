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
  Link,
  Copy,
  Check,
  Calendar,
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
  const [copied, setCopied] = useState(false);
  const [copiedPortal, setCopiedPortal] = useState(false);

  const bookingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/book/${workspace.slug}`
      : `/book/${workspace.slug}`;

  const portalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/portal/${workspace.slug}`
      : `/portal/${workspace.slug}`;

  const copyBookingLink = () => {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyPortalLink = () => {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopiedPortal(true);
      setTimeout(() => setCopiedPortal(false), 2000);
    });
  };
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

  const gcalStatus =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("gcal")
      : null;

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
          <div className="space-y-6">
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

          {/* Booking Link Card */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Link className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Client Booking Link</h3>
            </div>
            <p className="text-sm text-gray-500">
              Share this link with clients so they can self-schedule shoots directly. Their booking will automatically create a new job in your dashboard.
            </p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-700 flex-1 truncate">{bookingUrl}</span>
              <button
                type="button"
                onClick={copyBookingLink}
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <Link className="h-3.5 w-3.5" />
              Preview booking page
            </a>
          </div>

          {/* Client Portal Link Card */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Link className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Client Portal Link</h3>
            </div>
            <p className="text-sm text-gray-500">
              Share this link with clients so they can view their orders, download galleries, pay invoices, and book new shoots — all in one place.
            </p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-700 flex-1 truncate">{portalUrl}</span>
              <button
                type="button"
                onClick={copyPortalLink}
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors"
              >
                {copiedPortal ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedPortal ? "Copied!" : "Copy"}
              </button>
            </div>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:underline"
            >
              <Link className="h-3.5 w-3.5" />
              Preview client portal
            </a>
          </div>

          {/* Google Calendar Integration Card */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Google Calendar Sync</h3>
            </div>
            {gcalStatus === "connected" && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                ✓ Google Calendar connected successfully! New job assignments will appear on your calendar.
              </div>
            )}
            {gcalStatus === "error" && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                Connection failed. Please try again.
              </div>
            )}
            {gcalStatus === "already_connected" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                Your Google Calendar was already connected.
              </div>
            )}
            <p className="text-sm text-gray-500">
              Connect your Google Calendar to automatically add shoot appointments when jobs are assigned to you. Each photographer connects their own calendar from their profile.
            </p>
            <a
              href="/api/auth/google"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Connect Google Calendar
            </a>
            <p className="text-xs text-gray-400">
              You&apos;ll be redirected to Google to authorize access to your calendar. We only request permission to create and manage events.
            </p>
          </div>
          </div>
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

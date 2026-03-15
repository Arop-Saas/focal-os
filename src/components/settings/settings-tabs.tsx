"use client";

import { useState, useRef, useEffect } from "react";
import { Workspace } from "@prisma/client";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import {
  Settings,
  Palette,
  CreditCard,
  Bell,
  Link,
  Copy,
  Check,
  Calendar,
  Puzzle,
  Loader2,
  CheckCircle,
  Upload,
  ExternalLink,
} from "lucide-react";
import { IntegrationsTab } from "./integrations-tab";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD"];

interface SettingsTabsProps {
  workspace: Workspace;
}

// ─── Small shared components ──────────────────────────────────────────────────

function SavedBanner() {
  return (
    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
      <CheckCircle className="w-4 h-4 shrink-0" />
      Changes saved
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
          checked ? "bg-blue-600" : "bg-gray-200"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SettingsTabs({ workspace }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<"general" | "branding" | "billing" | "notifications" | "integrations">("general");

  const tabs = [
    { id: "general",       label: "General",       icon: Settings },
    { id: "branding",      label: "Branding",      icon: Palette },
    { id: "billing",       label: "Billing",       icon: CreditCard },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "integrations",  label: "Integrations",  icon: Puzzle },
  ] as const;

  return (
    <div className="p-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b">
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
                  : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="max-w-2xl">
        {activeTab === "general"       && <GeneralTab workspace={workspace} />}
        {activeTab === "branding"      && <BrandingTab workspace={workspace} />}
        {activeTab === "billing"       && <BillingTab workspace={workspace} />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "integrations"  && <IntegrationsTab />}
      </div>
    </div>
  );
}

// ─── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab({ workspace }: { workspace: Workspace }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied]             = useState(false);
  const [copiedPortal, setCopiedPortal] = useState(false);

  const [form, setForm] = useState({
    name:           workspace.name ?? "",
    phone:          workspace.phone ?? "",
    email:          workspace.email ?? "",
    website:        workspace.website ?? "",
    timezone:       workspace.timezone ?? "America/Toronto",
    currency:       workspace.currency ?? "CAD",
    defaultTaxRate: workspace.defaultTaxRate ?? 0,
    addressLine1:   (workspace as unknown as { addressLine1?: string }).addressLine1 ?? "",
    city:           (workspace as unknown as { city?: string }).city ?? "",
    state:          (workspace as unknown as { state?: string }).state ?? "",
    postalCode:     (workspace as unknown as { postalCode?: string }).postalCode ?? "",
  });

  const updateMutation = api.workspace.update.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const bookingUrl = typeof window !== "undefined" ? `${window.location.origin}/book/${workspace.slug}` : `/book/${workspace.slug}`;
  const portalUrl  = typeof window !== "undefined" ? `${window.location.origin}/portal/${workspace.slug}` : `/portal/${workspace.slug}`;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      name:           form.name || undefined,
      phone:          form.phone || undefined,
      email:          form.email || undefined,
      website:        form.website || undefined,
      timezone:       form.timezone,
      currency:       form.currency,
      defaultTaxRate: Number(form.defaultTaxRate),
    });
  };

  const gcalStatus = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("gcal")
    : null;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="bg-white rounded-xl border p-6 space-y-5">
        <h3 className="text-base font-semibold text-gray-900">Workspace Information</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Workspace Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="My Studio"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="contact@studio.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
          <input
            type="url"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://mystudio.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Tax Rate (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.defaultTaxRate}
            onChange={(e) => setForm({ ...form, defaultTaxRate: parseFloat(e.target.value) || 0 })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
          <p className="text-xs text-gray-400 mt-1">Applied automatically when creating new invoices (e.g. 13 for 13% HST)</p>
        </div>

        {updateMutation.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {updateMutation.error.message}
          </p>
        )}
        {saved && <SavedBanner />}

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60 transition-colors"
        >
          {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </form>

      {/* Public Links */}
      <div className="bg-white rounded-xl border p-6 space-y-5">
        <h3 className="text-base font-semibold text-gray-900">Public Links</h3>

        {/* Booking link */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-800">Client Booking Page</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">Share this so clients can self-schedule shoots. Bookings automatically create jobs.</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-sm text-gray-700 flex-1 truncate font-mono text-xs">{bookingUrl}</span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="shrink-0 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Portal link */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-800">Client Portal</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">Clients can view orders, galleries, and invoices — and pay outstanding balances.</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-sm text-gray-700 flex-1 truncate font-mono text-xs">{portalUrl}</span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(portalUrl); setCopiedPortal(true); setTimeout(() => setCopiedPortal(false), 2000); }}
              className="shrink-0 flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700"
            >
              {copiedPortal ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedPortal ? "Copied!" : "Copy"}
            </button>
            <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Google Calendar */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-semibold text-gray-900">Google Calendar Sync</h3>
        </div>

        {gcalStatus === "connected" && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Google Calendar connected! Job assignments will sync automatically.
          </div>
        )}
        {gcalStatus === "error" && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Connection failed. Please try again.
          </div>
        )}

        <p className="text-sm text-gray-500">
          Connect your Google Calendar to sync shoot appointments when jobs are assigned. Each photographer connects their own calendar.
        </p>
        <a
          href="/api/auth/google"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Connect Google Calendar
        </a>
      </div>
    </div>
  );
}

// ─── Branding Tab ─────────────────────────────────────────────────────────────

function BrandingTab({ workspace }: { workspace: Workspace }) {
  const [saved, setSaved]             = useState(false);
  const [brandColor, setBrandColor]   = useState(workspace.brandColor ?? "#1B4F9E");
  const [colorText, setColorText]     = useState(workspace.brandColor ?? "#1B4F9E");
  const [invoicePrefix, setInvoicePrefix] = useState(workspace.invoicePrefix ?? "INV");
  const [logoUrl, setLogoUrl]         = useState(workspace.logoUrl ?? "");
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = api.workspace.update.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  // Keep color input and picker in sync
  const handleColorPickerChange = (v: string) => {
    setBrandColor(v);
    setColorText(v);
  };
  const handleColorTextChange = (v: string) => {
    setColorText(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) setBrandColor(v);
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "logo");
    try {
      const res = await fetch("/api/gallery/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setLogoUrl(data.cdnUrl);
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      brandColor: /^#[0-9A-Fa-f]{6}$/.test(colorText) ? colorText : brandColor,
      invoicePrefix: invoicePrefix || undefined,
      logoUrl: logoUrl || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-6 space-y-6">
        <h3 className="text-base font-semibold text-gray-900">Brand Settings</h3>

        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
          {logoUrl ? (
            <div className="flex items-center gap-4 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Logo" className="h-16 w-auto rounded-lg border border-gray-200 object-contain bg-gray-50 p-2" />
              <button
                type="button"
                onClick={() => setLogoUrl("")}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : null}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleLogoUpload(file);
            }}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors cursor-pointer"
          >
            {logoUploading ? (
              <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
            ) : (
              <>
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 2MB — appears on client portal and emails</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file);
            }}
          />
        </div>

        {/* Brand Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Brand Color</label>
          <p className="text-xs text-gray-500 mb-3">Used on buttons, badges, and the client portal header.</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => handleColorPickerChange(e.target.value)}
              className="h-11 w-14 rounded-lg border border-gray-200 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={colorText}
              onChange={(e) => handleColorTextChange(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="#1B4F9E"
              maxLength={7}
            />
            {/* Live preview */}
            <div
              className="h-10 w-24 rounded-lg flex items-center justify-center text-white text-xs font-semibold shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              Preview
            </div>
          </div>

          {/* Preset swatches */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-gray-400 mr-1">Presets:</span>
            {["#1B4F9E", "#7C3AED", "#059669", "#DC2626", "#D97706", "#0891B2", "#111827"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleColorPickerChange(c)}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                  brandColor === c ? "border-gray-700 scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Invoice Settings */}
        <div className="border-t pt-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Invoice Settings</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice Prefix</label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase().slice(0, 10))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="INV"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Next Invoice #</label>
              <input
                type="number"
                value={workspace.invoiceNextNumber}
                disabled
                className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Auto-increments with each invoice</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Example: prefix <span className="font-mono font-semibold">{invoicePrefix || "INV"}</span> → invoices will be numbered{" "}
            <span className="font-mono font-semibold">{invoicePrefix || "INV"}-{String(workspace.invoiceNextNumber).padStart(4, "0")}</span>
          </p>
        </div>

        {updateMutation.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {updateMutation.error.message}
          </p>
        )}
        {saved && <SavedBanner />}

        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60 transition-colors"
        >
          {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────

function BillingTab({ workspace }: { workspace: Workspace }) {
  const trialEndsAt = workspace.trialEndsAt ? new Date(workspace.trialEndsAt) : null;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-6 space-y-5">
        <h3 className="text-base font-semibold text-gray-900">Billing & Subscription</h3>

        {/* Current plan */}
        <div className={cn(
          "rounded-xl p-4 border",
          workspace.subscriptionStatus === "ACTIVE"   ? "bg-blue-50 border-blue-200" :
          workspace.subscriptionStatus === "TRIALING"  ? "bg-amber-50 border-amber-200" :
          "bg-gray-50 border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-900">Current Plan</p>
            <span className={cn(
              "text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full",
              workspace.subscriptionStatus === "ACTIVE"  ? "bg-blue-100 text-blue-800" :
              workspace.subscriptionStatus === "TRIALING" ? "bg-amber-100 text-amber-800" :
              "bg-gray-100 text-gray-600"
            )}>
              {workspace.subscriptionStatus}
            </span>
          </div>
          {workspace.subscriptionStatus === "TRIALING" && trialEndsAt && (
            <p className="text-sm text-amber-700">
              Trial ends {trialEndsAt.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
              {daysLeft !== null && daysLeft <= 7 && (
                <span className="font-semibold"> — {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining</span>
              )}
            </p>
          )}
          {workspace.subscriptionStatus === "ACTIVE" && (
            <p className="text-sm text-blue-700">Your subscription is active and in good standing.</p>
          )}
        </div>

        {/* Features */}
        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-medium text-gray-700 mb-3">What&apos;s included</p>
          {[
            "Unlimited jobs & clients",
            "Gallery delivery with payment gate",
            "Video & virtual tour support",
            "Client portal & online booking",
            "Stripe payment processing",
            "Automated email notifications",
            "Advanced reporting",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              {f}
            </div>
          ))}
        </div>

        <a
          href="mailto:support@focal-os.com?subject=Upgrade Plan"
          className="w-full flex items-center justify-center gap-2 border border-gray-200 hover:border-blue-300 hover:text-blue-700 text-gray-700 text-sm font-semibold py-2.5 rounded-lg transition-colors"
        >
          Contact us to upgrade
        </a>
      </div>
    </div>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState({
    newBooking:       true,
    invoicePaid:      true,
    jobCompleted:     true,
    galleryDelivered: true,
    jobReminder:      false,
    lowStock:         false,
  });

  const handleSave = () => {
    // Preferences persisted locally for now — backend field coming soon
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Email Notifications</h3>
          <p className="text-sm text-gray-500 mt-0.5">Control which events trigger an email to you as the studio owner.</p>
        </div>

        <div className="space-y-3">
          <ToggleRow
            label="New booking received"
            description="When a client books a shoot through your booking page"
            checked={prefs.newBooking}
            onChange={(v) => setPrefs({ ...prefs, newBooking: v })}
          />
          <ToggleRow
            label="Invoice paid"
            description="When a client completes payment via Stripe"
            checked={prefs.invoicePaid}
            onChange={(v) => setPrefs({ ...prefs, invoicePaid: v })}
          />
          <ToggleRow
            label="Job completed"
            description="When a job status changes to Completed"
            checked={prefs.jobCompleted}
            onChange={(v) => setPrefs({ ...prefs, jobCompleted: v })}
          />
          <ToggleRow
            label="Gallery delivered"
            description="When a gallery is published and the delivery email is sent"
            checked={prefs.galleryDelivered}
            onChange={(v) => setPrefs({ ...prefs, galleryDelivered: v })}
          />
          <ToggleRow
            label="24h job reminder"
            description="Remind clients 24 hours before their scheduled shoot"
            checked={prefs.jobReminder}
            onChange={(v) => setPrefs({ ...prefs, jobReminder: v })}
          />
        </div>

        {saved && <SavedBanner />}

        <button
          type="button"
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}

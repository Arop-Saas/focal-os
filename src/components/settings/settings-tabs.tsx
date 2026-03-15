"use client";

import { useState, useRef } from "react";
import { Workspace } from "@prisma/client";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import {
  Copy,
  Check,
  Loader2,
  CheckCircle,
  Upload,
  ExternalLink,
  Building2,
  Palette,
  Link2,
  Receipt,
  Bell,
  Puzzle,
  CreditCard,
  Calendar,
  Globe,
  Mail,
  Phone,
  Package,
  Images,
  LayoutDashboard,
} from "lucide-react";
import { IntegrationsTab } from "./integrations-tab";

const TIMEZONES = [
  "America/Toronto", "America/New_York", "America/Chicago",
  "America/Denver", "America/Los_Angeles", "America/Anchorage",
  "America/Vancouver", "America/Edmonton", "America/Winnipeg",
  "Pacific/Honolulu", "Europe/London", "Europe/Paris",
  "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney",
];
const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD"];

interface SettingsTabsProps { workspace: Workspace }

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SavedBanner() {
  return (
    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
      <CheckCircle className="w-4 h-4 shrink-0" /> Changes saved
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", disabled }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
    />
  );
}

function CopyField({ value, color }: { value: string; color?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <span className="text-xs text-gray-600 flex-1 truncate font-mono">{value}</span>
      <button
        type="button"
        onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="shrink-0 flex items-center gap-1 text-xs font-medium transition-colors"
        style={{ color: copied ? "#16a34a" : (color ?? "#2563eb") }}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied!" : "Copy"}
      </button>
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 shrink-0">
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm text-gray-800 font-medium">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-blue-600" : "bg-gray-200"
        )}
      >
        <span className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )} />
      </button>
    </div>
  );
}

// ─── Portal Preview ───────────────────────────────────────────────────────────

function PortalPreview({ name, logoUrl, brandColor, bookingUrl, portalUrl }: {
  name: string; logoUrl: string; brandColor: string; bookingUrl: string; portalUrl: string;
}) {
  const [previewTab, setPreviewTab] = useState<"portal" | "signin">("portal");

  return (
    <div className="sticky top-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live Preview</p>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setPreviewTab("portal")}
            className={cn("text-xs font-medium px-3 py-1 rounded-md transition-colors", previewTab === "portal" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}
          >
            Client Portal
          </button>
          <button
            onClick={() => setPreviewTab("signin")}
            className={cn("text-xs font-medium px-3 py-1 rounded-md transition-colors", previewTab === "signin" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}
          >
            Sign In Screen
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white" style={{ transform: "scale(1)", transformOrigin: "top left" }}>
        {previewTab === "portal" ? (
          <div className="flex h-[420px] text-[11px]">
            {/* Sidebar */}
            <div className="w-[120px] border-r border-gray-100 bg-gray-50 flex flex-col shrink-0">
              {/* Logo area */}
              <div className="p-3 border-b border-gray-100">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={name} className="h-6 w-auto object-contain" />
                ) : (
                  <div className="font-bold text-gray-800 truncate text-xs">{name}</div>
                )}
                <div className="text-[9px] text-gray-400 mt-0.5 truncate">Jane Smith</div>
              </div>

              {/* Place Order button */}
              <div className="px-2 py-2">
                <div
                  className="w-full text-center text-[9px] font-semibold text-white rounded-md py-1.5 px-1"
                  style={{ backgroundColor: brandColor }}
                >
                  Place Order
                </div>
              </div>

              {/* Nav items */}
              <nav className="px-2 space-y-0.5 flex-1">
                {[
                  { icon: LayoutDashboard, label: "Dashboard", active: true },
                  { icon: Package, label: "Orders" },
                  { icon: Images, label: "Galleries" },
                  { icon: Receipt, label: "Invoices" },
                ].map(({ icon: Icon, label, active }) => (
                  <div
                    key={label}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer",
                      active ? "text-gray-900 font-medium bg-white" : "text-gray-500"
                    )}
                    style={active ? { color: brandColor } : {}}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </nav>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-hidden">
              {/* Top bar */}
              <div className="border-b border-gray-100 px-3 py-2 flex items-center justify-between bg-white">
                <div>
                  <p className="font-semibold text-gray-900">Good afternoon, Jane!</p>
                  <p className="text-[9px] text-gray-400">Welcome back to the {name} client portal.</p>
                </div>
                <div
                  className="text-[9px] font-semibold text-white rounded-md py-1 px-2 flex items-center gap-1"
                  style={{ backgroundColor: brandColor }}
                >
                  Place Order
                </div>
              </div>

              {/* Body */}
              <div className="p-3 space-y-2 bg-gray-50 h-full">
                <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Today's Appointments</p>
                <div className="bg-white rounded-lg border border-gray-100 p-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center shrink-0">
                    <Package className="w-3 h-3 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">123 Main Street</p>
                    <p className="text-[9px] text-gray-400">10:00 AM · #1042</p>
                  </div>
                  <div className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">CONFIRMED</div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {[["Total Orders", "12"], ["Open Invoices", "2"], ["Galleries", "5"]].map(([label, val]) => (
                    <div key={label} className="bg-white rounded-lg border border-gray-100 p-2">
                      <p className="text-[8px] text-gray-400">{label}</p>
                      <p className="text-base font-bold text-gray-900">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Sign In preview */
          <div className="h-[420px] flex flex-col items-center justify-center bg-gray-50 p-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 w-full max-w-[220px]">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={name} className="h-8 w-auto object-contain mx-auto mb-4" />
              ) : (
                <div className="text-center font-bold text-gray-900 mb-4 text-sm">{name}</div>
              )}
              <p className="text-center text-xs text-gray-500 mb-4">Sign in to access your portal</p>
              <div className="space-y-2">
                <div className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400">Email address</div>
                <div
                  className="text-center text-xs font-semibold text-white rounded-lg py-2"
                  style={{ backgroundColor: brandColor }}
                >
                  Send Magic Link
                </div>
              </div>
              <p className="text-center text-[9px] text-gray-400 mt-3">We&apos;ll email you a secure sign-in link</p>
            </div>
          </div>
        )}
      </div>

      {/* Links below preview */}
      <div className="mt-3 space-y-2">
        <div>
          <p className="text-xs text-gray-400 mb-1">Client Portal URL</p>
          <CopyField value={portalUrl} color={brandColor} />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Booking Page URL</p>
          <CopyField value={bookingUrl} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SettingsTabs({ workspace }: SettingsTabsProps) {
  // Shared state — used by both the form and the live preview
  const [name,        setName]        = useState(workspace.name ?? "");
  const [phone,       setPhone]       = useState(workspace.phone ?? "");
  const [email,       setEmail]       = useState(workspace.email ?? "");
  const [website,     setWebsite]     = useState(workspace.website ?? "");
  const [timezone,    setTimezone]    = useState(workspace.timezone ?? "America/Toronto");
  const [currency,    setCurrency]    = useState(workspace.currency ?? "CAD");
  const [taxRate,     setTaxRate]     = useState(String(workspace.defaultTaxRate ?? 0));
  const [invoicePrefix, setInvoicePrefix] = useState(workspace.invoicePrefix ?? "INV");
  const [brandColor,  setBrandColor]  = useState(workspace.brandColor ?? "#1B4F9E");
  const [colorText,   setColorText]   = useState(workspace.brandColor ?? "#1B4F9E");
  const [logoUrl,     setLogoUrl]     = useState(workspace.logoUrl ?? "");
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification prefs (UI only for now)
  const [notifPrefs, setNotifPrefs] = useState({
    newBooking: true, invoicePaid: true, jobCompleted: true,
    galleryDelivered: true, jobReminder: false,
  });

  const [generalSaved,  setGeneralSaved]  = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [notifSaved,    setNotifSaved]    = useState(false);

  const updateMutation = api.workspace.update.useMutation();

  const origin = typeof window !== "undefined" ? window.location.origin : "https://focal-os.vercel.app";
  const bookingUrl = `${origin}/book/${workspace.slug}`;
  const portalUrl  = `${origin}/portal/${workspace.slug}`;

  const gcalStatus = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("gcal")
    : null;

  const handleColorPickerChange = (v: string) => { setBrandColor(v); setColorText(v); };
  const handleColorTextChange   = (v: string) => { setColorText(v); if (/^#[0-9A-Fa-f]{6}$/.test(v)) setBrandColor(v); };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res  = await fetch("/api/workspace/logo-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) setLogoUrl(data.logoUrl);
    } finally {
      setLogoUploading(false);
    }
  };

  const saveGeneral = () => {
    updateMutation.mutate({
      name: name || undefined,
      phone: phone || undefined,
      email: email || undefined,
      website: website || undefined,
      timezone, currency,
      defaultTaxRate: parseFloat(taxRate) || 0,
    }, {
      onSuccess: () => { setGeneralSaved(true); setTimeout(() => setGeneralSaved(false), 3000); },
    });
  };

  const saveBranding = () => {
    const finalColor = /^#[0-9A-Fa-f]{6}$/.test(colorText) ? colorText : brandColor;
    updateMutation.mutate({
      brandColor: finalColor,
      invoicePrefix: invoicePrefix || undefined,
      logoUrl: logoUrl || undefined,
    }, {
      onSuccess: () => { setBrandingSaved(true); setTimeout(() => setBrandingSaved(false), 3000); },
    });
  };

  const saveNotifs = () => {
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
  };

  return (
    <div className="flex gap-8 p-6 max-w-[1200px]">
      {/* ── Left: Settings sections ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-6">

        {/* ── 1. Company ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <SectionHeading icon={Building2} title="Company Information" description="Your studio's public contact details" />
          <div className="space-y-4">
            <Field label="Studio Name">
              <TextInput value={name} onChange={setName} placeholder="My Studio" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <TextInput value={phone} onChange={setPhone} type="tel" placeholder="+1 (555) 000-0000" />
              </Field>
              <Field label="Email">
                <TextInput value={email} onChange={setEmail} type="email" placeholder="hello@studio.com" />
              </Field>
            </div>
            <Field label="Website">
              <TextInput value={website} onChange={setWebsite} type="url" placeholder="https://mystudio.com" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Timezone">
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </Field>
              <Field label="Currency">
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Default Tax Rate (%)" hint="Applied when creating new invoices (e.g. 13 for 13% HST)">
              <TextInput value={taxRate} onChange={setTaxRate} type="number" placeholder="0" />
            </Field>
            {generalSaved && <SavedBanner />}
            <button onClick={saveGeneral} disabled={updateMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60 transition-colors">
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save Company Info
            </button>
          </div>
        </div>

        {/* ── 2. Appearance & Branding ────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <SectionHeading icon={Palette} title="Appearance & Branding" description="Logo, colors, and invoice formatting — reflects instantly in the preview" />
          <div className="space-y-5">
            {/* Logo */}
            <Field label="Logo" hint="Appears on the client portal header and email notifications">
              {logoUrl && (
                <div className="flex items-center gap-3 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Logo" className="h-12 w-auto rounded-lg border border-gray-200 object-contain bg-gray-50 p-2 max-w-[140px]" />
                  <button type="button" onClick={() => setLogoUrl("")} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
              )}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLogoUpload(f); }}
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors cursor-pointer"
              >
                {logoUploading
                  ? <Loader2 className="w-5 h-5 text-gray-400 mx-auto animate-spin" />
                  : <>
                      <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
                      <p className="text-sm text-gray-600 font-medium">Click to upload or drag & drop</p>
                      <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WebP or SVG · max 2MB</p>
                    </>
                }
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
            </Field>

            {/* Brand color */}
            <Field label="Brand Color" hint="Used on buttons, badges, and portal header">
              <div className="flex items-center gap-3">
                <input type="color" value={brandColor} onChange={(e) => handleColorPickerChange(e.target.value)}
                  className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer p-0.5 shrink-0" />
                <input type="text" value={colorText} onChange={(e) => handleColorTextChange(e.target.value)} maxLength={7}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="#1B4F9E" />
                <div className="h-10 w-20 rounded-lg flex items-center justify-center text-white text-xs font-semibold shrink-0"
                  style={{ backgroundColor: brandColor }}>Preview</div>
              </div>
              {/* Presets */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400">Presets:</span>
                {["#1B4F9E","#7C3AED","#059669","#DC2626","#D97706","#0891B2","#111827"].map(c => (
                  <button key={c} type="button" onClick={() => handleColorPickerChange(c)}
                    className={cn("h-6 w-6 rounded-full border-2 transition-transform hover:scale-110", brandColor === c ? "border-gray-700" : "border-transparent")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </Field>

            {/* Invoice settings */}
            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice Settings</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Invoice Prefix">
                  <input type="text" value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase().slice(0, 10))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="INV" />
                </Field>
                <Field label="Next Invoice #" hint="Auto-increments">
                  <TextInput value={String(workspace.invoiceNextNumber)} disabled />
                </Field>
              </div>
              <p className="text-xs text-gray-400">
                Example: <span className="font-mono font-semibold">{invoicePrefix || "INV"}-{String(workspace.invoiceNextNumber).padStart(4, "0")}</span>
              </p>
            </div>

            {brandingSaved && <SavedBanner />}
            <button onClick={saveBranding} disabled={updateMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60 transition-colors">
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save Branding
            </button>
          </div>
        </div>

        {/* ── 3. Public Links ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <SectionHeading icon={Link2} title="Public Links" description="Share these with clients" />
          <div className="space-y-4">
            <Field label="Client Portal" hint="Clients can view orders, galleries, invoices, and pay outstanding balances">
              <CopyField value={portalUrl} color={brandColor} />
            </Field>
            <Field label="Online Booking Page" hint="Clients can self-schedule shoots — bookings automatically create jobs">
              <CopyField value={bookingUrl} />
            </Field>
          </div>
        </div>

        {/* ── 4. Google Calendar ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <SectionHeading icon={Calendar} title="Google Calendar Sync" description="Sync shoot appointments when jobs are assigned" />
          {gcalStatus === "connected" && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 mb-4">
              <CheckCircle className="w-4 h-4 shrink-0" /> Google Calendar connected successfully!
            </div>
          )}
          {gcalStatus === "error" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
              Connection failed. Please try again.
            </div>
          )}
          <p className="text-sm text-gray-500 mb-4">Each photographer connects their own calendar. Click below to connect yours.</p>
          <a href="/api/auth/google"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Connect Google Calendar
          </a>
        </div>

        {/* ── 5. Integrations ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <SectionHeading icon={Puzzle} title="Integrations" description="Connect Stripe, calendar, email, and more" />
          <IntegrationsTab />
        </div>

        {/* ── 6. Email Notifications ──────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <SectionHeading icon={Bell} title="Email Notifications" description="Control which events send you an email as studio owner" />
          <div>
            <ToggleRow label="New booking received" description="When a client books via your booking page" checked={notifPrefs.newBooking} onChange={(v) => setNotifPrefs({ ...notifPrefs, newBooking: v })} />
            <ToggleRow label="Invoice paid" description="When a client pays via Stripe" checked={notifPrefs.invoicePaid} onChange={(v) => setNotifPrefs({ ...notifPrefs, invoicePaid: v })} />
            <ToggleRow label="Job completed" description="When a job status changes to Completed" checked={notifPrefs.jobCompleted} onChange={(v) => setNotifPrefs({ ...notifPrefs, jobCompleted: v })} />
            <ToggleRow label="Gallery delivered" description="When you publish a gallery and the delivery email is sent" checked={notifPrefs.galleryDelivered} onChange={(v) => setNotifPrefs({ ...notifPrefs, galleryDelivered: v })} />
            <ToggleRow label="24h client reminder" description="Automatically remind clients the day before their shoot" checked={notifPrefs.jobReminder} onChange={(v) => setNotifPrefs({ ...notifPrefs, jobReminder: v })} />
          </div>
          {notifSaved && <div className="mt-3"><SavedBanner /></div>}
          <button onClick={saveNotifs}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
            Save Preferences
          </button>
        </div>

        {/* ── 7. Billing ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <SectionHeading icon={CreditCard} title="Billing & Subscription" />
          <div className={cn("rounded-xl p-4 border mb-5",
            workspace.subscriptionStatus === "ACTIVE"   ? "bg-blue-50 border-blue-200" :
            workspace.subscriptionStatus === "TRIALING" ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200")}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-900">Current Plan</p>
              <span className={cn("text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full",
                workspace.subscriptionStatus === "ACTIVE"   ? "bg-blue-100 text-blue-800" :
                workspace.subscriptionStatus === "TRIALING" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600")}>
                {workspace.subscriptionStatus}
              </span>
            </div>
            {workspace.subscriptionStatus === "TRIALING" && workspace.trialEndsAt && (
              <p className="text-xs text-amber-700">
                Trial ends {new Date(workspace.trialEndsAt).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
          <div className="space-y-2 mb-5">
            {["Unlimited jobs & clients","Gallery delivery with payment gate","Video & virtual tour support",
              "Client portal & online booking","Stripe payment processing","Automated email notifications","Advanced reporting"
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> {f}
              </div>
            ))}
          </div>
          <a href="mailto:support@focal-os.com?subject=Upgrade Plan"
            className="w-full flex items-center justify-center gap-2 border border-gray-200 hover:border-blue-300 hover:text-blue-700 text-gray-700 text-sm font-semibold py-2.5 rounded-lg transition-colors">
            Contact us to upgrade
          </a>
        </div>

      </div>

      {/* ── Right: Live Preview panel ──────────────────────────────────────── */}
      <div className="w-[320px] shrink-0 hidden xl:block">
        <PortalPreview
          name={name || workspace.name}
          logoUrl={logoUrl}
          brandColor={brandColor}
          bookingUrl={bookingUrl}
          portalUrl={portalUrl}
        />
      </div>
    </div>
  );
}

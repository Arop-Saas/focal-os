"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import {
  Loader2, Save, CheckCircle2, ArrowLeft, ExternalLink,
  Eye, EyeOff, Globe, Lock, Clock, Users, CreditCard, ClipboardList,
  Palette, Type, Search, ChevronRight, Smartphone, Tablet, Monitor, Tv,
  Settings, MousePointer, Image as ImageIcon,
} from "lucide-react";
import { DEFAULT_BOOKING_FORM_SETTINGS, type BookingFormSettings } from "@/lib/booking-form-types";

type FieldKey = keyof BookingFormSettings["fields"];
type PreviewSize = "xs" | "sm" | "md" | "lg" | "xl";
type SidebarSection =
  | "general"
  | "appearance"
  | "seo"
  | "step-address"
  | "step-services"
  | "step-scheduling"
  | "step-contact"
  | "step-confirm"
  | "scheduling"
  | "payment";

const PREVIEW_WIDTHS: Record<PreviewSize, number> = {
  xs: 320,
  sm: 375,
  md: 768,
  lg: 1024,
  xl: 1280,
};

const PREVIEW_ICONS: Record<PreviewSize, React.ElementType> = {
  xs: Smartphone,
  sm: Smartphone,
  md: Tablet,
  lg: Monitor,
  xl: Tv,
};

const FONT_OPTIONS = [
  { value: "Inter",  label: "Inter (Default)" },
  { value: "System", label: "System Font" },
  { value: "Serif",  label: "Serif (Georgia)" },
  { value: "Mono",   label: "Monospace" },
];

const BUTTON_STYLES = [
  { value: "rounded", label: "Rounded" },
  { value: "pill",    label: "Pill" },
  { value: "square",  label: "Square" },
];

const PROPERTY_FIELDS: { key: FieldKey; label: string; desc: string }[] = [
  { key: "propertyType", label: "Property Type",   desc: "Residential, Commercial, Land, etc." },
  { key: "sqft",         label: "Square Footage",  desc: "Total sq ft of the property" },
  { key: "beds",         label: "Bedrooms",         desc: "Number of bedrooms" },
  { key: "baths",        label: "Bathrooms",        desc: "Number of bathrooms" },
  { key: "mlsNumber",   label: "MLS Number",       desc: "Optional MLS listing number" },
  { key: "accessNotes", label: "Access Notes",     desc: "Lock box codes, gate info, etc." },
];

const CONTACT_FIELDS: { key: FieldKey; label: string; desc: string }[] = [
  { key: "phone",       label: "Phone Number",        desc: "Client's phone number" },
  { key: "company",     label: "Company / Brokerage", desc: "Client's company name" },
  { key: "clientNotes", label: "Order Notes",         desc: "Special requests from client" },
];

// ─── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({
  value, onChange, color = "blue",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  color?: "blue" | "orange";
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        value
          ? color === "orange" ? "bg-orange-400" : "bg-blue-500"
          : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ─── Save button ────────────────────────────────────────────────────────────

function SaveBtn({ onClick, loading, saved }: { onClick: () => void; loading: boolean; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-60 text-white"
      style={{ backgroundColor: saved ? "#16a34a" : "#2563eb" }}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
       saved   ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 <Save className="w-3.5 h-3.5" />}
      {loading ? "Saving…" : saved ? "Saved!" : "Save"}
    </button>
  );
}

// ─── Sidebar nav item ───────────────────────────────────────────────────────

function NavItem({
  icon: Icon, label, active, onClick, indent = false,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  indent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left ${
        indent ? "pl-7" : ""
      } ${
        active
          ? "bg-blue-50 text-blue-700 font-medium"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${active ? "rotate-90 text-blue-500" : "text-gray-300"}`} />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Designer Component
// ═══════════════════════════════════════════════════════════════════════════════

export function OrderFormDesigner({ formId, workspaceSlug }: { formId: string; workspaceSlug: string }) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { data: form, isLoading, refetch } = api.orderForm.get.useQuery({ id: formId });

  const updateGeneral    = api.orderForm.updateGeneral.useMutation();
  const updateFields     = api.orderForm.updateFields.useMutation();
  const updateScheduling = api.orderForm.updateScheduling.useMutation();
  const updatePayment    = api.orderForm.updatePayment.useMutation();
  const updateAppearance = api.orderForm.updateAppearance.useMutation();
  const updateSeo        = api.orderForm.updateSeo.useMutation();

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<SidebarSection>("general");
  const [previewSize, setPreviewSize]     = useState<PreviewSize>("lg");

  // General
  const [title, setTitle]             = useState("");
  const [welcomeMsg, setWelcomeMsg]   = useState("");
  const [isPublic, setIsPublic]       = useState(true);

  // Fields
  const [fields, setFields] = useState<BookingFormSettings["fields"]>(DEFAULT_BOOKING_FORM_SETTINGS.fields);

  // Scheduling
  const [confirmMode, setConfirmMode] = useState<"IMMEDIATE" | "MANUAL">("IMMEDIATE");
  const [assignStrat, setAssignStrat] = useState<"ROUND_ROBIN" | "CLOSEST" | "PRIORITY" | "AUTO">("ROUND_ROBIN");
  const [allowChoice, setAllowChoice] = useState(false);
  const [slotInterval, setSlotInterval] = useState(30);

  // Payment
  const [paymentMode, setPaymentMode] = useState<"NONE" | "FULL" | "PARTIAL">("NONE");
  const [deposit, setDeposit]         = useState(25);

  // Appearance
  const [accentColor, setAccentColor]         = useState("#2563eb");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [logoUrl, setLogoUrl]                 = useState("");
  const [fontFamily, setFontFamily]           = useState("Inter");
  const [buttonStyle, setButtonStyle]         = useState("rounded");
  const [showLogo, setShowLogo]               = useState(true);
  const [showStepNumbers, setShowStepNumbers] = useState(true);

  // SEO
  const [seoTitle, setSeoTitle]       = useState("");
  const [seoDesc, setSeoDesc]         = useState("");
  const [seoImage, setSeoImage]       = useState("");

  // Save states
  const [savedGeneral, setSavedGeneral]       = useState(false);
  const [savedFields, setSavedFields]         = useState(false);
  const [savedScheduling, setSavedScheduling] = useState(false);
  const [savedPayment, setSavedPayment]       = useState(false);
  const [savedAppearance, setSavedAppearance] = useState(false);
  const [savedSeo, setSavedSeo]               = useState(false);

  // ── Populate from DB ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!form) return;
    setTitle(form.title);
    setWelcomeMsg(form.welcomeMessage ?? "");
    setIsPublic(form.isPublic);
    setConfirmMode((form.confirmationMode as "IMMEDIATE" | "MANUAL") ?? "IMMEDIATE");
    setAssignStrat((form.assignmentStrategy as "ROUND_ROBIN" | "CLOSEST" | "PRIORITY" | "AUTO") ?? "ROUND_ROBIN");
    setAllowChoice(form.allowCustomerChoice);
    setSlotInterval(form.timeSlotInterval);
    setPaymentMode((form.paymentMode as "NONE" | "FULL" | "PARTIAL") ?? "NONE");
    setDeposit(form.depositPercent ?? 25);
    setAccentColor((form as any).accentColor ?? "#2563eb");
    setBackgroundColor((form as any).backgroundColor ?? "#ffffff");
    setLogoUrl((form as any).logoUrl ?? "");
    setFontFamily((form as any).fontFamily ?? "Inter");
    setButtonStyle((form as any).buttonStyle ?? "rounded");
    setShowLogo((form as any).showLogo ?? true);
    setShowStepNumbers((form as any).showStepNumbers ?? true);
    setSeoTitle((form as any).seoTitle ?? "");
    setSeoDesc((form as any).seoDescription ?? "");
    setSeoImage((form as any).seoImage ?? "");

    if (form.fieldSettings) {
      setFields({ ...DEFAULT_BOOKING_FORM_SETTINGS.fields, ...(form.fieldSettings as BookingFormSettings["fields"]) });
    }
  }, [form]);

  function setField(key: FieldKey, prop: "visible" | "required", value: boolean) {
    setFields((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [prop]: value,
        ...(prop === "visible" && !value ? { required: false } : {}),
      },
    }));
    setSavedFields(false);
  }

  const refreshPreview = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!form) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.scalist.io";
  const bookingUrl = `${origin}/book/${workspaceSlug}`;

  // ── Save handlers ──────────────────────────────────────────────────────────

  async function saveGeneral() {
    await updateGeneral.mutateAsync({ id: formId, title, welcomeMessage: welcomeMsg, isPublic });
    setSavedGeneral(true);
    refreshPreview();
    setTimeout(() => setSavedGeneral(false), 3000);
  }

  async function saveFields() {
    await updateFields.mutateAsync({ id: formId, fieldSettings: fields });
    setSavedFields(true);
    refreshPreview();
    setTimeout(() => setSavedFields(false), 3000);
  }

  async function saveScheduling() {
    await updateScheduling.mutateAsync({
      id: formId, confirmationMode: confirmMode,
      assignmentStrategy: assignStrat, allowCustomerChoice: allowChoice,
      timeSlotInterval: slotInterval,
    });
    setSavedScheduling(true);
    setTimeout(() => setSavedScheduling(false), 3000);
  }

  async function savePayment() {
    await updatePayment.mutateAsync({
      id: formId, paymentMode,
      depositPercent: paymentMode === "PARTIAL" ? deposit : null,
    });
    setSavedPayment(true);
    setTimeout(() => setSavedPayment(false), 3000);
  }

  async function saveAppearance() {
    await updateAppearance.mutateAsync({
      id: formId, accentColor, backgroundColor, fontFamily: fontFamily as any,
      buttonStyle: buttonStyle as any, showLogo, showStepNumbers,
      logoUrl: logoUrl || null,
    });
    setSavedAppearance(true);
    refreshPreview();
    setTimeout(() => setSavedAppearance(false), 3000);
  }

  async function saveSeo() {
    await updateSeo.mutateAsync({
      id: formId,
      seoTitle: seoTitle || null,
      seoDescription: seoDesc || null,
      seoImage: seoImage || null,
    });
    setSavedSeo(true);
    setTimeout(() => setSavedSeo(false), 3000);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left sidebar ────────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-gray-100 bg-white flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <button
            onClick={() => router.push("/order-form")}
            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{title || "Order Form"}</p>
            <p className="text-[10px] text-gray-400">Form Designer</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Settings</p>
          <NavItem icon={Settings}       label="General Settings"  active={activeSection === "general"}    onClick={() => setActiveSection("general")} />
          <NavItem icon={Palette}        label="Appearance"        active={activeSection === "appearance"} onClick={() => setActiveSection("appearance")} />
          <NavItem icon={Search}         label="SEO Settings"      active={activeSection === "seo"}        onClick={() => setActiveSection("seo")} />

          <div className="pt-2">
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Steps</p>
            <NavItem icon={ClipboardList}  label="Step 1: Address"   active={activeSection === "step-address"}    onClick={() => setActiveSection("step-address")} indent />
            <NavItem icon={ClipboardList}  label="Step 2: Services"  active={activeSection === "step-services"}   onClick={() => setActiveSection("step-services")} indent />
            <NavItem icon={Clock}          label="Step 3: Scheduling" active={activeSection === "step-scheduling"} onClick={() => setActiveSection("step-scheduling")} indent />
            <NavItem icon={Users}          label="Step 4: Contact"   active={activeSection === "step-contact"}    onClick={() => setActiveSection("step-contact")} indent />
            <NavItem icon={CheckCircle2}   label="Step 5: Confirm"   active={activeSection === "step-confirm"}    onClick={() => setActiveSection("step-confirm")} indent />
          </div>

          <div className="pt-2">
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Behavior</p>
            <NavItem icon={Clock}       label="Scheduling"   active={activeSection === "scheduling"} onClick={() => setActiveSection("scheduling")} />
            <NavItem icon={CreditCard}  label="Payment"      active={activeSection === "payment"}    onClick={() => setActiveSection("payment")} />
          </div>
        </div>

        {/* Footer link */}
        <div className="px-3 py-3 border-t border-gray-100">
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View live form
          </a>
        </div>
      </div>

      {/* ── Right content area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">

        {/* Preview size controls */}
        <div className="shrink-0 px-4 py-2 bg-white border-b border-gray-100 flex items-center justify-center gap-1">
          {(Object.keys(PREVIEW_WIDTHS) as PreviewSize[]).map((size) => {
            const Icon = PREVIEW_ICONS[size];
            return (
              <button
                key={size}
                onClick={() => setPreviewSize(size)}
                className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                  previewSize === size
                    ? "bg-gray-900 text-white"
                    : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                {size}
              </button>
            );
          })}
        </div>

        {/* Split: settings panel + preview */}
        <div className="flex-1 flex overflow-hidden">

          {/* Settings panel */}
          <div className="w-80 shrink-0 overflow-y-auto border-r border-gray-100 bg-white p-4">
            {activeSection === "general" && (
              <SectionPanel title="General Settings" desc="Name, welcome message, and visibility">
                <div className="space-y-4">
                  <Field label="Form Title">
                    <input
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); setSavedGeneral(false); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Standard Booking Form"
                    />
                  </Field>
                  <Field label="Welcome Message" optional>
                    <textarea
                      value={welcomeMsg}
                      onChange={(e) => { setWelcomeMsg(e.target.value); setSavedGeneral(false); }}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Shown at the top of your booking page…"
                    />
                  </Field>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Public visibility</p>
                      <p className="text-xs text-gray-400">Appears on your booking page</p>
                    </div>
                    <Toggle value={isPublic} onChange={(v) => { setIsPublic(v); setSavedGeneral(false); }} />
                  </div>
                  <div className="flex justify-end pt-1">
                    <SaveBtn loading={updateGeneral.isPending} saved={savedGeneral} onClick={saveGeneral} />
                  </div>
                </div>
              </SectionPanel>
            )}

            {activeSection === "appearance" && (
              <SectionPanel title="Appearance" desc="Customize colors, fonts, and branding">
                <div className="space-y-4">
                  <Field label="Accent Color">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => { setAccentColor(e.target.value); setSavedAppearance(false); }}
                        className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <input
                        value={accentColor}
                        onChange={(e) => { setAccentColor(e.target.value); setSavedAppearance(false); }}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </Field>
                  <Field label="Background Color">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => { setBackgroundColor(e.target.value); setSavedAppearance(false); }}
                        className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <input
                        value={backgroundColor}
                        onChange={(e) => { setBackgroundColor(e.target.value); setSavedAppearance(false); }}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </Field>
                  <Field label="Logo URL" optional>
                    <input
                      value={logoUrl}
                      onChange={(e) => { setLogoUrl(e.target.value); setSavedAppearance(false); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com/logo.png"
                    />
                  </Field>
                  <Field label="Font Family">
                    <select
                      value={fontFamily}
                      onChange={(e) => { setFontFamily(e.target.value); setSavedAppearance(false); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Button Style">
                    <div className="flex gap-2">
                      {BUTTON_STYLES.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => { setButtonStyle(s.value); setSavedAppearance(false); }}
                          className={`flex-1 px-3 py-2 text-xs font-medium border-2 transition-colors ${
                            buttonStyle === s.value
                              ? "border-blue-400 bg-blue-50 text-blue-700"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          } ${
                            s.value === "rounded" ? "rounded-lg" : s.value === "pill" ? "rounded-full" : "rounded-none"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Show Logo</p>
                      <p className="text-xs text-gray-400">Display logo at top of form</p>
                    </div>
                    <Toggle value={showLogo} onChange={(v) => { setShowLogo(v); setSavedAppearance(false); }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Show Step Numbers</p>
                      <p className="text-xs text-gray-400">Show numbered step indicators</p>
                    </div>
                    <Toggle value={showStepNumbers} onChange={(v) => { setShowStepNumbers(v); setSavedAppearance(false); }} />
                  </div>
                  <div className="flex justify-end pt-1">
                    <SaveBtn loading={updateAppearance.isPending} saved={savedAppearance} onClick={saveAppearance} />
                  </div>
                </div>
              </SectionPanel>
            )}

            {activeSection === "seo" && (
              <SectionPanel title="SEO Settings" desc="Optimize how your form appears in search results and social media">
                <div className="space-y-4">
                  <Field label="Page Title" optional>
                    <input
                      value={seoTitle}
                      onChange={(e) => { setSeoTitle(e.target.value); setSavedSeo(false); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Book a Photography Session — Alphaspace"
                      maxLength={120}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">{seoTitle.length}/120 characters</p>
                  </Field>
                  <Field label="Meta Description" optional>
                    <textarea
                      value={seoDesc}
                      onChange={(e) => { setSeoDesc(e.target.value); setSavedSeo(false); }}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Professional real estate photography — book online in minutes."
                      maxLength={300}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">{seoDesc.length}/300 characters</p>
                  </Field>
                  <Field label="Open Graph Image URL" optional>
                    <input
                      value={seoImage}
                      onChange={(e) => { setSeoImage(e.target.value); setSavedSeo(false); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com/og-image.jpg"
                    />
                  </Field>
                  <div className="flex justify-end pt-1">
                    <SaveBtn loading={updateSeo.isPending} saved={savedSeo} onClick={saveSeo} />
                  </div>
                </div>
              </SectionPanel>
            )}

            {activeSection === "step-address" && (
              <SectionPanel title="Step 1: Address Details" desc="Configure which property fields are shown">
                <FieldToggleList
                  fields={PROPERTY_FIELDS}
                  values={fields}
                  onToggle={(key, prop, val) => { setField(key, prop, val); }}
                />
                <div className="flex justify-end pt-3">
                  <SaveBtn loading={updateFields.isPending} saved={savedFields} onClick={saveFields} />
                </div>
              </SectionPanel>
            )}

            {activeSection === "step-services" && (
              <SectionPanel title="Step 2: Services" desc="Packages and services are managed in the Products page">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">
                    Service offerings are configured in <strong>Products</strong>. Clients will see all active packages and services on the booking form.
                  </p>
                  <button
                    onClick={() => router.push("/products")}
                    className="mt-2 text-xs text-blue-600 hover:underline font-medium"
                  >
                    Go to Products
                  </button>
                </div>
              </SectionPanel>
            )}

            {activeSection === "step-scheduling" && (
              <SectionPanel title="Step 3: Scheduling" desc="Time slot interval and scheduling behavior">
                <div className="space-y-4">
                  <Field label="Time Slot Interval">
                    <select
                      value={slotInterval}
                      onChange={(e) => { setSlotInterval(Number(e.target.value)); setSavedScheduling(false); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>60 minutes</option>
                      <option value={90}>90 minutes</option>
                    </select>
                  </Field>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Allow photographer choice</p>
                      <p className="text-xs text-gray-400">Client can pick their photographer</p>
                    </div>
                    <Toggle value={allowChoice} onChange={(v) => { setAllowChoice(v); setSavedScheduling(false); }} />
                  </div>
                  <div className="flex justify-end pt-1">
                    <SaveBtn loading={updateScheduling.isPending} saved={savedScheduling} onClick={saveScheduling} />
                  </div>
                </div>
              </SectionPanel>
            )}

            {activeSection === "step-contact" && (
              <SectionPanel title="Step 4: Contact" desc="Configure which contact fields are shown">
                <FieldToggleList
                  fields={CONTACT_FIELDS}
                  values={fields}
                  onToggle={(key, prop, val) => { setField(key, prop, val); }}
                />
                <div className="flex justify-end pt-3">
                  <SaveBtn loading={updateFields.isPending} saved={savedFields} onClick={saveFields} />
                </div>
              </SectionPanel>
            )}

            {activeSection === "step-confirm" && (
              <SectionPanel title="Step 5: Confirmation" desc="Review and confirmation step settings">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    The confirmation step shows a summary of the order. Clients review their selection before submitting.
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    No additional configuration needed for this step.
                  </p>
                </div>
              </SectionPanel>
            )}

            {activeSection === "scheduling" && (
              <SectionPanel title="Scheduling Behavior" desc="Control how appointments are confirmed and assigned">
                <div className="space-y-4">
                  <Field label="Confirmation Mode">
                    {(["IMMEDIATE", "MANUAL"] as const).map((mode) => (
                      <label key={mode} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors mb-2 ${confirmMode === mode ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-200"}`}>
                        <input type="radio" name="confirm" checked={confirmMode === mode} onChange={() => { setConfirmMode(mode); setSavedScheduling(false); }} className="mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{mode === "IMMEDIATE" ? "Auto-confirm" : "Manual approval"}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {mode === "IMMEDIATE" ? "Booked instantly when client submits." : "You review and approve each booking."}
                          </p>
                        </div>
                      </label>
                    ))}
                  </Field>
                  <Field label="Assignment Strategy">
                    {([
                      { val: "AUTO",        label: "Auto",         desc: "Best match by availability + distance" },
                      { val: "ROUND_ROBIN", label: "Round Robin",  desc: "Distribute evenly across team" },
                      { val: "CLOSEST",     label: "Closest",      desc: "Nearest to the property" },
                      { val: "PRIORITY",    label: "Priority",     desc: "Top-priority staff first" },
                    ] as const).map(({ val, label, desc }) => (
                      <label key={val} className={`flex items-start gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-colors mb-1.5 ${assignStrat === val ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-200"}`}>
                        <input type="radio" name="assign" checked={assignStrat === val} onChange={() => { setAssignStrat(val); setSavedScheduling(false); }} className="mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-gray-800">{label}</p>
                          <p className="text-[10px] text-gray-400">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </Field>
                  <div className="flex justify-end pt-1">
                    <SaveBtn loading={updateScheduling.isPending} saved={savedScheduling} onClick={saveScheduling} />
                  </div>
                </div>
              </SectionPanel>
            )}

            {activeSection === "payment" && (
              <SectionPanel title="Payment Settings" desc="Require payment at booking time">
                <div className="space-y-3">
                  {([
                    { val: "NONE",    label: "No Payment",    desc: "Invoice separately." },
                    { val: "FULL",    label: "Full Payment",  desc: "Client pays the full balance." },
                    { val: "PARTIAL", label: "Deposit",       desc: "Client pays a percentage upfront." },
                  ] as const).map(({ val, label, desc }) => (
                    <label key={val} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${paymentMode === val ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-200"}`}>
                      <input type="radio" name="payment" checked={paymentMode === val} onChange={() => { setPaymentMode(val); setSavedPayment(false); }} className="mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                        {val === "PARTIAL" && paymentMode === "PARTIAL" && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="number" min={1} max={99} value={deposit}
                              onChange={(e) => { setDeposit(Number(e.target.value)); setSavedPayment(false); }}
                              className="w-20 px-2 py-1 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-500">%</span>
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                  <div className="flex justify-end pt-1">
                    <SaveBtn loading={updatePayment.isPending} saved={savedPayment} onClick={savePayment} />
                  </div>
                </div>
              </SectionPanel>
            )}
          </div>

          {/* Preview iframe */}
          <div className="flex-1 flex items-start justify-center overflow-auto p-6">
            <div
              className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden transition-all duration-300 shrink-0"
              style={{
                width: `${PREVIEW_WIDTHS[previewSize]}px`,
                height: previewSize === "xs" || previewSize === "sm" ? "667px" : "80vh",
                maxHeight: "85vh",
              }}
            >
              <iframe
                ref={iframeRef}
                src={bookingUrl}
                className="w-full h-full"
                title="Form Preview"
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function SectionPanel({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-400 mb-4">{desc}</p>
      {children}
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}
        {optional && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function FieldToggleList({
  fields, values, onToggle,
}: {
  fields: { key: FieldKey; label: string; desc: string }[];
  values: BookingFormSettings["fields"];
  onToggle: (key: FieldKey, prop: "visible" | "required", val: boolean) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_48px_56px] gap-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        <span>Field</span><span className="text-center">Show</span><span className="text-center">Req</span>
      </div>
      {fields.map(({ key, label, desc }) => (
        <div key={key} className="grid grid-cols-[1fr_48px_56px] gap-2 items-center px-2 py-2 rounded-lg hover:bg-gray-50">
          <div>
            <p className="text-xs font-medium text-gray-700">{label}</p>
            <p className="text-[10px] text-gray-400">{desc}</p>
          </div>
          <div className="flex justify-center">
            <Toggle value={values[key].visible} onChange={(v) => onToggle(key, "visible", v)} />
          </div>
          <div className="flex justify-center">
            <Toggle value={values[key].required} onChange={(v) => onToggle(key, "required", v)} color="orange" />
          </div>
        </div>
      ))}
      <p className="text-[10px] text-gray-400 pt-2 px-2">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Visible</span>
        {" · "}
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Required</span>
      </p>
    </div>
  );
}

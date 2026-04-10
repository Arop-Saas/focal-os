"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/trpc/client";
import {
  Loader2, Save, CheckCircle2, ArrowLeft, ExternalLink,
  Globe, Lock, Clock, CreditCard, ClipboardList,
  Palette, Type, Search, ChevronDown, Smartphone, Tablet, Monitor,
  Settings2, Eye, MapPin, ShoppingBag, CalendarClock, UserCircle,
  CheckSquare, Zap, LayoutDashboard, Upload, X, Plus, Trash2, Image as ImageIcon,
} from "lucide-react";
import { DEFAULT_BOOKING_FORM_SETTINGS, DEFAULT_PORTAL_SETTINGS, type BookingFormSettings, type CustomField, type PortalSettings } from "@/lib/booking-form-types";
import { CustomFieldBuilder } from "./custom-field-builder";
import { PackagesView } from "@/components/packages/packages-view";

// ── Client-side image compression ───────────────────────────────────────────
// Resizes large images to max 1600px and compresses to JPEG ≤ 1.5MB
async function compressImage(file: File, maxWidth = 1600, maxHeight = 1200, quality = 0.85): Promise<File> {
  // Skip if already small enough
  if (file.size <= 1.5 * 1024 * 1024) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      // Scale down if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
          resolve(compressed);
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

type FieldKey = keyof BookingFormSettings["fields"];
type PreviewSize = "mobile" | "tablet" | "desktop";
type SidebarSection =
  | "general"
  | "appearance"
  | "seo"
  | "portal"
  | "step-1"
  | "step-2"
  | "step-3"
  | "step-4"
  | "step-5"
  | "scheduling"
  | "payment";

const STEP_MAP: Record<string, number> = {
  "step-1": 1, "step-2": 2, "step-3": 3, "step-4": 4, "step-5": 5,
};

const PREVIEW_WIDTHS: Record<PreviewSize, number> = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
};

const FONT_OPTIONS = [
  { value: "Inter",  label: "Inter" },
  { value: "System", label: "System" },
  { value: "Serif",  label: "Georgia" },
  { value: "Mono",   label: "Monospace" },
];

const BUTTON_STYLES = [
  { value: "rounded", label: "Rounded",  radius: "8px" },
  { value: "pill",    label: "Pill",      radius: "999px" },
  { value: "square",  label: "Square",    radius: "0px" },
];

const PROPERTY_FIELDS: { key: FieldKey; label: string }[] = [
  { key: "propertyType", label: "Property Type" },
  { key: "sqft",         label: "Square Footage" },
  { key: "beds",         label: "Bedrooms" },
  { key: "baths",        label: "Bathrooms" },
  { key: "mlsNumber",    label: "MLS Number" },
  { key: "accessNotes",  label: "Access Notes" },
];

const CONTACT_FIELDS: { key: FieldKey; label: string }[] = [
  { key: "phone",       label: "Phone Number" },
  { key: "company",     label: "Company / Brokerage" },
  { key: "clientNotes", label: "Order Notes" },
];

// ─── Compact toggle ─────────────────────────────────────────────────────────

function Toggle({ value, onChange, color = "blue" }: { value: boolean; onChange: (v: boolean) => void; color?: string }) {
  const bg = value
    ? color === "amber" ? "bg-amber-500" : "bg-blue-600"
    : "bg-gray-300";
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer rounded-full transition-colors ${bg}`}
    >
      <span className={`pointer-events-none inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm transition-transform mt-[2px] ${value ? "translate-x-[20px] ml-0" : "translate-x-[2px]"}`} />
    </button>
  );
}

// ─── Save pill ──────────────────────────────────────────────────────────────

function SavePill({ onClick, loading, saved }: { onClick: () => void; loading: boolean; saved: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
        saved ? "bg-emerald-500 text-white" : "bg-gray-900 text-white hover:bg-gray-800"
      }`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
       saved   ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 <Save className="w-3.5 h-3.5" />}
      {loading ? "Saving…" : saved ? "Saved" : "Save Changes"}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Designer
// ═══════════════════════════════════════════════════════════════════════════════

export function OrderFormDesigner({ formId, workspaceSlug }: { formId: string; workspaceSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { data: form, isLoading } = api.orderForm.get.useQuery({ id: formId });

  const updateGeneral    = api.orderForm.updateGeneral.useMutation();
  const updateFields     = api.orderForm.updateFields.useMutation();
  const updateScheduling = api.orderForm.updateScheduling.useMutation();
  const updatePayment    = api.orderForm.updatePayment.useMutation();
  const updateAppearance = api.orderForm.updateAppearance.useMutation();
  const updateSeo          = api.orderForm.updateSeo.useMutation();
  const updateCustomFields = api.orderForm.updateCustomFields.useMutation();
  const savePortalSettings = api.workspace.savePortalSettings.useMutation();
  const { data: portalData } = api.workspace.getPortalSettings.useQuery();

  // ── UI state ──────────────────────────────────────────────────────────────
  const initialSection = (searchParams.get("section") as SidebarSection) || "general";
  const [activeSection, setActiveSection] = useState<SidebarSection>(initialSection);
  const [previewSize, setPreviewSize]     = useState<PreviewSize>("desktop");

  // General
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage]   = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
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
  const [seoTitle, setSeoTitle]   = useState("");
  const [seoDesc, setSeoDesc]     = useState("");
  const [seoImage, setSeoImage]   = useState("");

  // Save states
  const [savedGeneral, setSavedGeneral]       = useState(false);
  const [savedFields, setSavedFields]         = useState(false);
  const [savedScheduling, setSavedScheduling] = useState(false);
  const [savedPayment, setSavedPayment]       = useState(false);
  const [savedAppearance, setSavedAppearance] = useState(false);
  const [savedSeo, setSavedSeo]               = useState(false);
  const [savedCustom, setSavedCustom]         = useState(false);

  // Grid columns (Step 2)
  const [gridColumns, setGridColumns] = useState(3);

  // Order Details settings (Step 2)
  const [showCouponField, setShowCouponField] = useState(false);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [taxRate, setTaxRate] = useState(0);
  const [taxLabel, setTaxLabel] = useState("Tax");
  const [showLineItemDetails, setShowLineItemDetails] = useState(true);

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Portal settings
  const [portalHeroImage, setPortalHeroImage]       = useState("");
  const [portalWelcomeTitle, setPortalWelcomeTitle] = useState("");
  const [portalWelcomeText, setPortalWelcomeText]   = useState("");
  const [portalContactPhone, setPortalContactPhone] = useState("");
  const [portalContactEmail, setPortalContactEmail] = useState("");
  const [portalLayout, setPortalLayout]             = useState<PortalSettings["layout"]>("split");
  const [portalShowLogin, setPortalShowLogin]       = useState(true);
  const [portalShowRegister, setPortalShowRegister] = useState(true);
  const [portalShowOrderForms, setPortalShowOrderForms] = useState(true);
  const [portalBullets, setPortalBullets]           = useState<string[]>(DEFAULT_PORTAL_SETTINGS.featureBullets!);
  const [portalCardStyle, setPortalCardStyle]       = useState<"list" | "imageGrid">("list");
  const [savedPortal, setSavedPortal]               = useState(false);
  const [heroUploading, setHeroUploading]           = useState(false);

  // ── Populate ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!form) return;
    setTitle(form.title);
    setDescription((form as any).description ?? "");
    setCoverImage((form as any).coverImage ?? "");
    setWelcomeMsg(form.welcomeMessage ?? "");
    setIsPublic(form.isPublic);
    setConfirmMode((form.confirmationMode as any) ?? "IMMEDIATE");
    setAssignStrat((form.assignmentStrategy as any) ?? "ROUND_ROBIN");
    setAllowChoice(form.allowCustomerChoice);
    setSlotInterval(form.timeSlotInterval);
    setPaymentMode((form.paymentMode as any) ?? "NONE");
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
    setCustomFields(((form as any).customFields as CustomField[]) ?? []);
    setGridColumns((form.fieldSettings as any)?.gridColumns ?? DEFAULT_BOOKING_FORM_SETTINGS.gridColumns ?? 3);
    const od = (form.fieldSettings as any)?.orderDetails ?? DEFAULT_BOOKING_FORM_SETTINGS.orderDetails ?? {};
    setShowCouponField(od.showCouponField ?? false);
    setShowPriceBreakdown(od.showPriceBreakdown ?? true);
    setShowTotal(od.showTotal ?? true);
    setTaxRate(od.taxRate ?? 0);
    setTaxLabel(od.taxLabel ?? "Tax");
    setShowLineItemDetails(od.showLineItemDetails ?? true);
    if (form.fieldSettings) {
      setFields({ ...DEFAULT_BOOKING_FORM_SETTINGS.fields, ...(form.fieldSettings as BookingFormSettings["fields"]) });
    }
  }, [form]);

  // ── Populate portal settings ──────────────────────────────────────────────
  useEffect(() => {
    if (!portalData?.settings) return;
    const ps = portalData.settings;
    setPortalHeroImage(ps.heroImageUrl ?? "");
    setPortalWelcomeTitle(ps.welcomeTitle ?? "");
    setPortalWelcomeText(ps.welcomeText ?? "");
    setPortalContactPhone(ps.contactPhone ?? portalData.settings.contactPhone ?? "");
    setPortalContactEmail(ps.contactEmail ?? portalData.settings.contactEmail ?? "");
    setPortalLayout(ps.layout ?? "split");
    setPortalShowLogin(ps.showLogin ?? true);
    setPortalShowRegister(ps.showRegister ?? true);
    setPortalShowOrderForms(ps.showOrderForms ?? true);
    setPortalBullets(ps.featureBullets ?? DEFAULT_PORTAL_SETTINGS.featureBullets!);
    setPortalCardStyle(ps.portalCardStyle ?? "list");
  }, [portalData]);

  function setField(key: FieldKey, prop: "visible" | "required", value: boolean) {
    setFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], [prop]: value, ...(prop === "visible" && !value ? { required: false } : {}) },
    }));
    setSavedFields(false);
  }

  // ── Send step to iframe via postMessage ───────────────────────────────────
  const sendStepToPreview = useCallback((stepNum: number) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "DESIGNER_SET_STEP", step: stepNum },
        "*"
      );
    }
  }, []);

  function handleSectionChange(section: SidebarSection) {
    const wasPortal = activeSection === "portal";
    const isPortal = section === "portal";
    setActiveSection(section);
    // Switch iframe between portal and booking URLs when toggling
    if (wasPortal !== isPortal && iframeRef.current) {
      const target = isPortal ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${workspaceSlug}` : `${typeof window !== "undefined" ? window.location.origin : ""}/book/${workspaceSlug}?form=${formId}`;
      iframeRef.current.src = target;
    }
    const stepNum = STEP_MAP[section];
    if (stepNum) sendStepToPreview(stepNum);
  }

  // ── Live sync: send state to iframe whenever fields/customFields change ───
  const sendLiveUpdate = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: "DESIGNER_LIVE_UPDATE",
        fieldSettings: fields,
        customFields,
        gridColumns,
      }, "*");
    }
  }, [fields, customFields, gridColumns]);

  useEffect(() => { sendLiveUpdate(); }, [sendLiveUpdate]);

  const refreshPreview = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handler = () => {
      iframe.removeEventListener("load", handler);
      // Small delay to let React hydrate inside the iframe before posting
      setTimeout(() => sendLiveUpdate(), 300);
    };
    iframe.addEventListener("load", handler);
    iframe.src = iframe.src;
  }, [sendLiveUpdate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!form) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.scalist.io";
  const bookingUrl = `${origin}/book/${workspaceSlug}?form=${formId}`;
  const portalUrl = `${origin}/portal/${workspaceSlug}`;
  const previewUrl = activeSection === "portal" ? portalUrl : bookingUrl;

  // ── Save handlers ─────────────────────────────────────────────────────────

  async function saveGeneral() {
    await updateGeneral.mutateAsync({ id: formId, title, description: description || null, coverImage: coverImage || null, welcomeMessage: welcomeMsg, isPublic });
    setSavedGeneral(true); refreshPreview();
    setTimeout(() => setSavedGeneral(false), 3000);
  }
  async function saveFields() {
    await updateFields.mutateAsync({ id: formId, fieldSettings: { ...fields, gridColumns, orderDetails: { showCouponField, showPriceBreakdown, showTotal, taxRate, taxLabel, showLineItemDetails } } as any });
    setSavedFields(true); refreshPreview();
    setTimeout(() => setSavedFields(false), 3000);
  }
  async function saveScheduling() {
    await updateScheduling.mutateAsync({ id: formId, confirmationMode: confirmMode, assignmentStrategy: assignStrat, allowCustomerChoice: allowChoice, timeSlotInterval: slotInterval });
    setSavedScheduling(true);
    setTimeout(() => setSavedScheduling(false), 3000);
  }
  async function savePayment() {
    await updatePayment.mutateAsync({ id: formId, paymentMode, depositPercent: paymentMode === "PARTIAL" ? deposit : null });
    setSavedPayment(true);
    setTimeout(() => setSavedPayment(false), 3000);
  }
  async function saveAppearance() {
    await updateAppearance.mutateAsync({ id: formId, accentColor, backgroundColor, fontFamily: fontFamily as any, buttonStyle: buttonStyle as any, showLogo, showStepNumbers, logoUrl: logoUrl || null });
    setSavedAppearance(true); refreshPreview();
    setTimeout(() => setSavedAppearance(false), 3000);
  }
  async function saveSeo() {
    await updateSeo.mutateAsync({ id: formId, seoTitle: seoTitle || null, seoDescription: seoDesc || null, seoImage: seoImage || null });
    setSavedSeo(true);
    setTimeout(() => setSavedSeo(false), 3000);
  }
  async function saveCustomFields() {
    await updateCustomFields.mutateAsync({ id: formId, customFields });
    setSavedCustom(true); refreshPreview();
    setTimeout(() => setSavedCustom(false), 3000);
  }

  // ── Portal save + hero upload ──────────────────────────────────────────────
  async function savePortal() {
    await savePortalSettings.mutateAsync({
      heroImageUrl: portalHeroImage || undefined,
      welcomeTitle: portalWelcomeTitle || undefined,
      welcomeText: portalWelcomeText || undefined,
      contactPhone: portalContactPhone || undefined,
      contactEmail: portalContactEmail || undefined,
      layout: portalLayout,
      showLogin: portalShowLogin,
      showRegister: portalShowRegister,
      showOrderForms: portalShowOrderForms,
      featureBullets: portalBullets.filter(Boolean),
      portalCardStyle,
    });
    setSavedPortal(true);
    // Reload the portal preview if showing it
    if (activeSection === "portal") refreshPreview();
    setTimeout(() => setSavedPortal(false), 3000);
  }

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroUploading(true);
    try {
      const compressed = await compressImage(file, 1920, 1200);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch("/api/workspace/portal-hero-upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.heroImageUrl) {
        setPortalHeroImage(json.heroImageUrl);
        setSavedPortal(false);
      }
    } catch (err) {
      console.error("Hero upload failed:", err);
    } finally {
      setHeroUploading(false);
    }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const compressed = await compressImage(file, 1600, 1200);
      const fd = new FormData();
      fd.append("file", compressed);
      fd.append("formId", formId);
      const res = await fetch("/api/order-form/cover-upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { alert("Upload failed: " + (json.error ?? "Unknown error")); return; }
      if (json.coverImage) { setCoverImage(json.coverImage); setSavedGeneral(false); }
    } catch (err) { console.error("Cover upload failed:", err); alert("Cover upload failed. Please try again."); }
    finally { setCoverUploading(false); }
  }

  // Helper for custom fields onChange — mark dirty + trigger live update
  function handleCustomFieldsChange(updated: CustomField[]) {
    setCustomFields(updated);
    setSavedCustom(false);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full overflow-hidden bg-[#f8f9fb]">

      {/* ══ LEFT: Dark sidebar nav ═══════════════════════════════════════════ */}
      <div className="w-[220px] shrink-0 bg-[#0f1117] flex flex-col overflow-hidden">

        {/* Brand / back */}
        <div className="px-4 pt-4 pb-3">
          <button onClick={() => router.push("/order-form")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to forms
          </button>
          <p className="text-white text-sm font-semibold truncate">{title || "Untitled Form"}</p>
          <p className="text-gray-500 text-[10px] mt-0.5 uppercase tracking-wider font-medium">Form Designer</p>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">

          <NavGroup label="Settings">
            <NavBtn icon={Settings2}  label="General"    active={activeSection === "general"}    onClick={() => handleSectionChange("general")} />
            <NavBtn icon={Palette}    label="Appearance"  active={activeSection === "appearance"} onClick={() => handleSectionChange("appearance")} />
            <NavBtn icon={Search}     label="SEO"         active={activeSection === "seo"}        onClick={() => handleSectionChange("seo")} />
          </NavGroup>

          <NavGroup label="Steps">
            <NavBtn icon={LayoutDashboard} label="Client Portal" active={activeSection === "portal"} onClick={() => handleSectionChange("portal")} />
            <NavBtn icon={MapPin}        label="Address"     active={activeSection === "step-1"} onClick={() => handleSectionChange("step-1")} number={1} />
            <NavBtn icon={ShoppingBag}   label="Services"    active={activeSection === "step-2"} onClick={() => handleSectionChange("step-2")} number={2} />
            <NavBtn icon={CalendarClock} label="Scheduling"  active={activeSection === "step-3"} onClick={() => handleSectionChange("step-3")} number={3} />
            <NavBtn icon={UserCircle}    label="Contact"     active={activeSection === "step-4"} onClick={() => handleSectionChange("step-4")} number={4} />
            <NavBtn icon={CheckSquare}   label="Confirmation" active={activeSection === "step-5"} onClick={() => handleSectionChange("step-5")} number={5} />
          </NavGroup>

          <NavGroup label="Behavior">
            <NavBtn icon={Zap}         label="Scheduling" active={activeSection === "scheduling"} onClick={() => handleSectionChange("scheduling")} />
            <NavBtn icon={CreditCard}  label="Payment"    active={activeSection === "payment"}    onClick={() => handleSectionChange("payment")} />
          </NavGroup>

        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800">
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-blue-400 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> View form
          </a>
        </div>
      </div>

      {/* ══ CENTER: Settings panel ═══════════════════════════════════════════ */}
      <div className="w-[340px] shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-5">

          {activeSection === "general" && (
            <Panel title="General Settings" desc="Name, visibility, and welcome text">
              <InputField label="Form Title" value={title} onChange={(v) => { setTitle(v); setSavedGeneral(false); }} placeholder="e.g. Standard Booking" />
              <TextareaField label="Description" value={description} onChange={(v) => { setDescription(v); setSavedGeneral(false); }} placeholder="Short description shown on portal cards…" optional rows={2} maxLength={300} counter />

              {/* Cover image upload */}
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cover Image</label>
                <p className="text-[11px] text-gray-400 mt-0.5 mb-1.5">Shown on the portal card when image grid style is enabled</p>
                {coverImage ? (
                  <div className="relative group rounded-xl overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverImage} alt="Cover" className="w-full h-32 object-cover" />
                    <button
                      onClick={() => { setCoverImage(""); setSavedGeneral(false); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                    {coverUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">Click to upload (max 5 MB)</span>
                      </>
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverUpload} className="hidden" />
                  </label>
                )}
              </div>

              <TextareaField label="Welcome Message" value={welcomeMsg} onChange={(v) => { setWelcomeMsg(v); setSavedGeneral(false); }} placeholder="Shown at the top of your booking page…" optional rows={3} />
              <ToggleRow label="Public" desc="Visible on your booking page" value={isPublic} onChange={(v) => { setIsPublic(v); setSavedGeneral(false); }} />
              <SaveBar><SavePill loading={updateGeneral.isPending} saved={savedGeneral} onClick={saveGeneral} /></SaveBar>
            </Panel>
          )}

          {activeSection === "appearance" && (
            <Panel title="Appearance" desc="Colors, fonts, and branding">
              <ColorField label="Accent Color" value={accentColor} onChange={(v) => { setAccentColor(v); setSavedAppearance(false); }} />
              <ColorField label="Background" value={backgroundColor} onChange={(v) => { setBackgroundColor(v); setSavedAppearance(false); }} />
              <InputField label="Logo URL" value={logoUrl} onChange={(v) => { setLogoUrl(v); setSavedAppearance(false); }} placeholder="https://…/logo.png" optional />

              <div className="mt-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Font</label>
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {FONT_OPTIONS.map((f) => (
                    <button key={f.value} onClick={() => { setFontFamily(f.value); setSavedAppearance(false); }}
                      className={`px-2 py-2 text-[11px] font-medium rounded-lg border-2 transition-all ${
                        fontFamily === f.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                      style={{ fontFamily: f.value === "Serif" ? "Georgia" : f.value === "Mono" ? "monospace" : f.value === "System" ? "system-ui" : "Inter, sans-serif" }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Button Style</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {BUTTON_STYLES.map((s) => (
                    <button key={s.value} onClick={() => { setButtonStyle(s.value); setSavedAppearance(false); }}
                      className={`py-2.5 text-[11px] font-semibold border-2 transition-all text-white ${
                        buttonStyle === s.value ? "ring-2 ring-blue-500 ring-offset-1" : ""
                      }`}
                      style={{ borderRadius: s.radius, backgroundColor: accentColor, borderColor: accentColor }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <ToggleRow label="Show Logo" desc="Display at the top of the form" value={showLogo} onChange={(v) => { setShowLogo(v); setSavedAppearance(false); }} />
              <ToggleRow label="Step Numbers" desc="Show numbered step indicators" value={showStepNumbers} onChange={(v) => { setShowStepNumbers(v); setSavedAppearance(false); }} />
              <SaveBar><SavePill loading={updateAppearance.isPending} saved={savedAppearance} onClick={saveAppearance} /></SaveBar>
            </Panel>
          )}

          {activeSection === "seo" && (
            <Panel title="SEO Settings" desc="Search engine and social media preview">
              <InputField label="Page Title" value={seoTitle} onChange={(v) => { setSeoTitle(v); setSavedSeo(false); }} placeholder="Book a Session — Alphaspace" optional maxLength={120} counter />
              <TextareaField label="Meta Description" value={seoDesc} onChange={(v) => { setSeoDesc(v); setSavedSeo(false); }} placeholder="Professional real estate photography…" optional rows={3} maxLength={300} counter />
              <InputField label="OG Image URL" value={seoImage} onChange={(v) => { setSeoImage(v); setSavedSeo(false); }} placeholder="https://…/og.jpg" optional />
              <SaveBar><SavePill loading={updateSeo.isPending} saved={savedSeo} onClick={saveSeo} /></SaveBar>
            </Panel>
          )}

          {activeSection === "portal" && (
            <Panel title="Client Portal" desc="Customize your client-facing portal landing page">
              {/* Hero image upload */}
              <div className="mt-0">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Hero Image</label>
                {portalHeroImage ? (
                  <div className="mt-1.5 relative group rounded-xl overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={portalHeroImage} alt="Portal hero" className="w-full h-36 object-cover" />
                    <button
                      onClick={() => { setPortalHeroImage(""); setSavedPortal(false); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="mt-1.5 flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                    {heroUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    ) : (
                      <>
                        <ImageIcon className="w-6 h-6 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">Click to upload (max 5 MB)</span>
                      </>
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleHeroUpload} className="hidden" />
                  </label>
                )}
              </div>

              {/* Text fields */}
              <InputField label="Welcome Title" value={portalWelcomeTitle} onChange={(v) => { setPortalWelcomeTitle(v); setSavedPortal(false); }} placeholder="e.g. Welcome to Our Portal" optional maxLength={200} />
              <TextareaField label="Welcome Text" value={portalWelcomeText} onChange={(v) => { setPortalWelcomeText(v); setSavedPortal(false); }} placeholder="Brief description for your clients…" optional rows={3} maxLength={500} />
              <InputField label="Contact Phone" value={portalContactPhone} onChange={(v) => { setPortalContactPhone(v); setSavedPortal(false); }} placeholder="(555) 123-4567" optional />
              <InputField label="Contact Email" value={portalContactEmail} onChange={(v) => { setPortalContactEmail(v); setSavedPortal(false); }} placeholder="hello@company.com" optional />

              {/* Layout selector */}
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Layout</label>
                {([
                  { val: "split",    label: "Split",     desc: "Form left, hero image right" },
                  { val: "centered", label: "Centered",  desc: "Centered card over hero" },
                  { val: "fullHero", label: "Full Hero",  desc: "Full-width hero with overlay" },
                ] as const).map(({ val, label, desc }) => (
                  <RadioCard key={val} selected={portalLayout === val} onClick={() => { setPortalLayout(val); setSavedPortal(false); }}
                    label={label} desc={desc}
                  />
                ))}
              </div>

              {/* Visibility toggles */}
              <Divider label="Sections" />
              <ToggleRow label="Sign In" desc="Show 'I have an account' option" value={portalShowLogin} onChange={(v) => { setPortalShowLogin(v); setSavedPortal(false); }} />
              <ToggleRow label="Register" desc="Show 'Create an account' option" value={portalShowRegister} onChange={(v) => { setPortalShowRegister(v); setSavedPortal(false); }} />
              <ToggleRow label="Order Forms" desc="Show order form cards for direct booking" value={portalShowOrderForms} onChange={(v) => { setPortalShowOrderForms(v); setSavedPortal(false); }} />

              {/* Card style selector */}
              {portalShowOrderForms && (
                <div className="mt-3">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Card Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { val: "list" as const, label: "List", desc: "Simple text rows" },
                      { val: "imageGrid" as const, label: "Image Grid", desc: "Cards with cover photos" },
                    ]).map(({ val, label, desc }) => (
                      <button key={val} onClick={() => { setPortalCardStyle(val); setSavedPortal(false); }}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          portalCardStyle === val
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <p className={`text-xs font-semibold ${portalCardStyle === val ? "text-blue-700" : "text-gray-700"}`}>{label}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feature bullets */}
              <Divider label="Feature Bullets" />
              <p className="text-[11px] text-gray-500 mb-2">Shown on the right panel (split layout)</p>
              {portalBullets.map((bullet, i) => (
                <div key={i} className="flex items-center gap-1.5 mb-1.5">
                  <input
                    value={bullet}
                    onChange={(e) => {
                      const updated = [...portalBullets];
                      updated[i] = e.target.value;
                      setPortalBullets(updated);
                      setSavedPortal(false);
                    }}
                    placeholder="Feature text…"
                    className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  />
                  <button
                    onClick={() => {
                      setPortalBullets(portalBullets.filter((_, j) => j !== i));
                      setSavedPortal(false);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {portalBullets.length < 8 && (
                <button
                  onClick={() => { setPortalBullets([...portalBullets, ""]); setSavedPortal(false); }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add bullet
                </button>
              )}

              <SaveBar><SavePill loading={savePortalSettings.isPending} saved={savedPortal} onClick={savePortal} /></SaveBar>
            </Panel>
          )}

          {activeSection === "step-1" && (
            <Panel title="Step 1 — Address" desc="Built-in property fields and custom fields">
              <FieldTable fields={PROPERTY_FIELDS} values={fields} onToggle={setField} />
              <ToggleRow
                label="Map Preview"
                desc="Show a Mapbox map pin after the address is entered"
                value={fields.showMapPreview !== false}
                onChange={(v) => { setFields({ ...fields, showMapPreview: v } as any); setSavedFields(false); }}
              />
              <SaveBar><SavePill loading={updateFields.isPending} saved={savedFields} onClick={saveFields} /></SaveBar>
              <Divider label="Custom Fields" />
              <CustomFieldBuilder step={1} fields={customFields} onChange={handleCustomFieldsChange} />
              {customFields.some((f) => f.step === 1) && (
                <SaveBar><SavePill loading={updateCustomFields.isPending} saved={savedCustom} onClick={saveCustomFields} /></SaveBar>
              )}
            </Panel>
          )}

          {activeSection === "step-2" && (
            <Panel title="Step 2 — Services" desc="Manage your services, packages, and pricing">
              {/* Full Products & Services management embedded */}
              <PackagesView compact />

              {/* Order Details settings */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3 mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Order Details</p>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Coupon / Promo Code</p>
                    <p className="text-[10px] text-gray-400">Let customers apply discount codes</p>
                  </div>
                  <input type="checkbox" checked={showCouponField} onChange={(e) => { setShowCouponField(e.target.checked); setSavedFields(false); }}
                    className="w-8 h-4 rounded-full appearance-none bg-gray-300 checked:bg-blue-600 relative cursor-pointer transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3 after:h-3 after:bg-white after:rounded-full after:transition-transform checked:after:translate-x-4" />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Price Breakdown</p>
                    <p className="text-[10px] text-gray-400">Show individual line items in sidebar</p>
                  </div>
                  <input type="checkbox" checked={showPriceBreakdown} onChange={(e) => { setShowPriceBreakdown(e.target.checked); setSavedFields(false); }}
                    className="w-8 h-4 rounded-full appearance-none bg-gray-300 checked:bg-blue-600 relative cursor-pointer transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3 after:h-3 after:bg-white after:rounded-full after:transition-transform checked:after:translate-x-4" />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Show Total</p>
                    <p className="text-[10px] text-gray-400">Display total amount in order summary</p>
                  </div>
                  <input type="checkbox" checked={showTotal} onChange={(e) => { setShowTotal(e.target.checked); setSavedFields(false); }}
                    className="w-8 h-4 rounded-full appearance-none bg-gray-300 checked:bg-blue-600 relative cursor-pointer transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3 after:h-3 after:bg-white after:rounded-full after:transition-transform checked:after:translate-x-4" />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Line Item Details</p>
                    <p className="text-[10px] text-gray-400">Show service details per line item</p>
                  </div>
                  <input type="checkbox" checked={showLineItemDetails} onChange={(e) => { setShowLineItemDetails(e.target.checked); setSavedFields(false); }}
                    className="w-8 h-4 rounded-full appearance-none bg-gray-300 checked:bg-blue-600 relative cursor-pointer transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3 after:h-3 after:bg-white after:rounded-full after:transition-transform checked:after:translate-x-4" />
                </label>

                <div className="pt-1 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Tax Rate</p>
                      <p className="text-[10px] text-gray-400">Applied to subtotal (0 = no tax)</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" min="0" max="30" step="0.5" value={taxRate} onChange={(e) => { setTaxRate(parseFloat(e.target.value) || 0); setSavedFields(false); }}
                        className="w-16 px-2 py-1 text-xs text-right border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  </div>
                  {taxRate > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700">Tax Label</p>
                      <input type="text" value={taxLabel} onChange={(e) => { setTaxLabel(e.target.value); setSavedFields(false); }} placeholder="Tax"
                        className="w-24 px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  )}
                </div>
              </div>

              {/* Grid columns setting */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Layout Settings</p>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-700">Items per row</label>
                    <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">{gridColumns}</span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={5}
                    step={1}
                    value={gridColumns}
                    onChange={(e) => { setGridColumns(Number(e.target.value)); setSavedFields(false); }}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-400">3</span>
                    <span className="text-[10px] text-gray-400">4</span>
                    <span className="text-[10px] text-gray-400">5</span>
                  </div>
                </div>
              </div>

              <SaveBar><SavePill loading={updateFields.isPending} saved={savedFields} onClick={saveFields} /></SaveBar>

              <Divider label="Custom Fields" />
              <CustomFieldBuilder step={2} fields={customFields} onChange={handleCustomFieldsChange} />
              {customFields.some((f) => f.step === 2) && (
                <SaveBar><SavePill loading={updateCustomFields.isPending} saved={savedCustom} onClick={saveCustomFields} /></SaveBar>
              )}
            </Panel>
          )}

          {activeSection === "step-3" && (
            <Panel title="Step 3 — Scheduling" desc="Time slots, photographer selection, and custom fields">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Time Slot Interval</label>
                <select value={slotInterval} onChange={(e) => { setSlotInterval(Number(e.target.value)); setSavedScheduling(false); }}
                  className="mt-1.5 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                >
                  <option value={15}>Every 15 min</option>
                  <option value={30}>Every 30 min</option>
                  <option value={60}>Every 60 min</option>
                  <option value={90}>Every 90 min</option>
                </select>
              </div>
              <ToggleRow label="Photographer Choice" desc="Let clients pick their photographer" value={allowChoice} onChange={(v) => { setAllowChoice(v); setSavedScheduling(false); }} />
              <SaveBar><SavePill loading={updateScheduling.isPending} saved={savedScheduling} onClick={saveScheduling} /></SaveBar>
              <Divider label="Custom Fields" />
              <CustomFieldBuilder step={3} fields={customFields} onChange={handleCustomFieldsChange} />
              {customFields.some((f) => f.step === 3) && (
                <SaveBar><SavePill loading={updateCustomFields.isPending} saved={savedCustom} onClick={saveCustomFields} /></SaveBar>
              )}
            </Panel>
          )}

          {activeSection === "step-4" && (
            <Panel title="Step 4 — Contact" desc="Client info and custom fields">
              <FieldTable fields={CONTACT_FIELDS} values={fields} onToggle={setField} />
              <SaveBar><SavePill loading={updateFields.isPending} saved={savedFields} onClick={saveFields} /></SaveBar>
              <Divider label="Custom Fields" />
              <CustomFieldBuilder step={4} fields={customFields} onChange={handleCustomFieldsChange} />
              {customFields.some((f) => f.step === 4) && (
                <SaveBar><SavePill loading={updateCustomFields.isPending} saved={savedCustom} onClick={saveCustomFields} /></SaveBar>
              )}
            </Panel>
          )}

          {activeSection === "step-5" && (
            <Panel title="Step 5 — Confirmation" desc="Review and any final custom fields">
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm text-gray-600">Clients review their full order here before booking.</p>
              </div>
              <Divider label="Custom Fields" />
              <CustomFieldBuilder step={5} fields={customFields} onChange={handleCustomFieldsChange} />
              {customFields.some((f) => f.step === 5) && (
                <SaveBar><SavePill loading={updateCustomFields.isPending} saved={savedCustom} onClick={saveCustomFields} /></SaveBar>
              )}
            </Panel>
          )}

          {activeSection === "scheduling" && (
            <Panel title="Scheduling Behavior" desc="How bookings are confirmed and assigned">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Confirmation</label>
                {(["IMMEDIATE", "MANUAL"] as const).map((mode) => (
                  <RadioCard key={mode} selected={confirmMode === mode} onClick={() => { setConfirmMode(mode); setSavedScheduling(false); }}
                    label={mode === "IMMEDIATE" ? "Auto-confirm" : "Manual approval"}
                    desc={mode === "IMMEDIATE" ? "Instant when client submits" : "You review each booking"}
                  />
                ))}
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Assignment</label>
                {([
                  { val: "AUTO",        label: "Auto",        desc: "Best match by availability + distance" },
                  { val: "ROUND_ROBIN", label: "Round Robin", desc: "Distribute evenly" },
                  { val: "CLOSEST",     label: "Closest",     desc: "Nearest to property" },
                  { val: "PRIORITY",    label: "Priority",    desc: "Top-priority staff first" },
                ] as const).map(({ val, label, desc }) => (
                  <RadioCard key={val} selected={assignStrat === val} onClick={() => { setAssignStrat(val); setSavedScheduling(false); }}
                    label={label} desc={desc}
                  />
                ))}
              </div>
              <SaveBar><SavePill loading={updateScheduling.isPending} saved={savedScheduling} onClick={saveScheduling} /></SaveBar>
            </Panel>
          )}

          {activeSection === "payment" && (
            <Panel title="Payment Settings" desc="Require payment at booking">
              {([
                { val: "NONE",    label: "No Payment",   desc: "Invoice separately" },
                { val: "FULL",    label: "Full Payment",  desc: "Pay entire balance at booking" },
                { val: "PARTIAL", label: "Deposit",       desc: "Pay a percentage upfront" },
              ] as const).map(({ val, label, desc }) => (
                <div key={val}>
                  <RadioCard selected={paymentMode === val} onClick={() => { setPaymentMode(val); setSavedPayment(false); }}
                    label={label} desc={desc}
                  />
                  {val === "PARTIAL" && paymentMode === "PARTIAL" && (
                    <div className="ml-6 mb-2 flex items-center gap-2">
                      <input type="number" min={1} max={99} value={deposit}
                        onChange={(e) => { setDeposit(Number(e.target.value)); setSavedPayment(false); }}
                        className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-500">% deposit</span>
                    </div>
                  )}
                </div>
              ))}
              <SaveBar><SavePill loading={updatePayment.isPending} saved={savedPayment} onClick={savePayment} /></SaveBar>
            </Panel>
          )}

        </div>
      </div>

      {/* ══ RIGHT: Live preview ══════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Preview toolbar */}
        <div className="shrink-0 h-12 bg-white border-b border-gray-200 flex items-center justify-center gap-2 px-4">
          {(["mobile", "tablet", "desktop"] as PreviewSize[]).map((size) => {
            const icons = { mobile: Smartphone, tablet: Tablet, desktop: Monitor };
            const Icon = icons[size];
            return (
              <button key={size} onClick={() => setPreviewSize(size)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  previewSize === size
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {size.charAt(0).toUpperCase() + size.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Preview frame */}
        <div className="flex-1 flex items-start justify-center overflow-auto p-6 bg-[#e8eaee]">
          <div className="transition-all duration-500 ease-out shrink-0"
            style={{
              width: `${PREVIEW_WIDTHS[previewSize]}px`,
              height: previewSize === "mobile" ? "844px" : previewSize === "tablet" ? "80vh" : "85vh",
              maxHeight: "90vh",
              borderRadius: previewSize === "mobile" ? "40px" : previewSize === "tablet" ? "20px" : "12px",
              padding: previewSize === "mobile" ? "12px" : previewSize === "tablet" ? "8px" : "0",
              backgroundColor: previewSize === "mobile" || previewSize === "tablet" ? "#1a1a1a" : "transparent",
              boxShadow: "0 25px 60px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08)",
            }}
          >
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="w-full h-full bg-white"
              style={{
                borderRadius: previewSize === "mobile" ? "28px" : previewSize === "tablet" ? "12px" : "12px",
              }}
              title="Form Preview"
              onLoad={() => {
                const stepNum = STEP_MAP[activeSection];
                if (stepNum) sendStepToPreview(stepNum);
                sendLiveUpdate();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavBtn({ icon: Icon, label, active, onClick, number }: {
  icon: React.ElementType; label: string; active: boolean; onClick: () => void; number?: number;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all text-left ${
        active
          ? "bg-white/10 text-white font-medium"
          : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
      }`}
    >
      {number ? (
        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
          active ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-400"
        }`}>{number}</span>
      ) : (
        <Icon className="w-4 h-4 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}

function Panel({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, optional, maxLength, counter }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; optional?: boolean; maxLength?: number; counter?: boolean;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label} {optional && <span className="text-gray-400 normal-case tracking-normal font-normal">— optional</span>}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength}
        className="mt-1.5 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
      />
      {counter && maxLength && <p className="text-[10px] text-gray-400 mt-1 text-right">{value.length}/{maxLength}</p>}
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder, optional, rows, maxLength, counter }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; optional?: boolean; rows?: number; maxLength?: number; counter?: boolean;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label} {optional && <span className="text-gray-400 normal-case tracking-normal font-normal">— optional</span>}
      </label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows ?? 3} maxLength={maxLength}
        className="mt-1.5 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none transition-colors"
      />
      {counter && maxLength && <p className="text-[10px] text-gray-400 mt-1 text-right">{value.length}/{maxLength}</p>}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-4 first:mt-0">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2 mt-1.5">
        <div className="relative">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="w-10 h-10 rounded-lg border-2 border-gray-200 shadow-inner" style={{ backgroundColor: value }} />
        </div>
        <input value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
        />
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between mt-4">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-400">{desc}</p>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function RadioCard({ selected, onClick, label, desc }: { selected: boolean; onClick: () => void; label: string; desc: string }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3.5 py-3 rounded-xl border-2 transition-all mb-2 ${
        selected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
      }`}
    >
      <p className={`text-sm font-medium ${selected ? "text-blue-700" : "text-gray-700"}`}>{label}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
    </button>
  );
}

function SaveBar({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end pt-4 mt-4 border-t border-gray-100">{children}</div>;
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-4 mt-2">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

function FieldTable({ fields, values, onToggle }: {
  fields: { key: FieldKey; label: string }[];
  values: BookingFormSettings["fields"];
  onToggle: (key: FieldKey, prop: "visible" | "required", val: boolean) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_52px_52px] gap-1 px-1 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        <span>Field</span><span className="text-center">Show</span><span className="text-center">Req</span>
      </div>
      <div className="divide-y divide-gray-100">
        {fields.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-[1fr_52px_52px] gap-1 items-center py-3 px-1">
            <p className={`text-sm ${values[key].visible ? "text-gray-800 font-medium" : "text-gray-400"}`}>{label}</p>
            <div className="flex justify-center">
              <Toggle value={values[key].visible} onChange={(v) => onToggle(key, "visible", v)} />
            </div>
            <div className="flex justify-center">
              <Toggle value={values[key].required} onChange={(v) => onToggle(key, "required", v)} color="amber" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Visible</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Required</span>
      </p>
    </div>
  );
}

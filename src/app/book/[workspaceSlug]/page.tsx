"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { format, addDays, startOfDay, isToday, isBefore } from "date-fns";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { MapboxMap } from "@/components/shared/mapbox-map";
import { type BookingFormSettings, type CustomField, DEFAULT_BOOKING_FORM_SETTINGS } from "@/lib/booking-form-types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

interface FormData {
  // Step 1 – Property
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  propertyType: string;
  squareFootage: string;
  bedrooms: string;
  bathrooms: string;
  mlsNumber: string;
  accessNotes: string;
  propertyLat: number | null;
  propertyLng: number | null;
  // Step 2 – Package / À la carte
  packageId: string;
  selectedServiceIds: string[];
  // Step 3 – Date/Time + Photographer
  scheduledDate: string; // "YYYY-MM-DD"
  scheduledTime: string; // "HH:MM"
  photographerId: string; // staffProfileId of selected photographer
  // Step 4 – Contact
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  clientNotes: string;
}

const initialForm: FormData = {
  propertyAddress: "",
  propertyCity: "",
  propertyState: "",
  propertyZip: "",
  propertyType: "RESIDENTIAL",
  squareFootage: "",
  bedrooms: "",
  bathrooms: "",
  mlsNumber: "",
  accessNotes: "",
  propertyLat: null,
  propertyLng: null,
  packageId: "",
  selectedServiceIds: [],
  scheduledDate: "",
  scheduledTime: "",
  photographerId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  clientNotes: "",
};

// Generate 30-min time slots between two "HH:MM" strings (24h)
function generateTimeSlots(openTime: string, closeTime: string) {
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  const startMins = oh * 60 + (om ?? 0);
  const endMins = ch * 60 + (cm ?? 0);
  const slots: { label: string; value: string }[] = [];
  for (let t = startMins; t < endMins; t += 30) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const label = `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    slots.push({ label, value });
  }
  return slots;
}

// Property type labels
const PROPERTY_TYPES = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "LAND", label: "Land / Lot" },
  { value: "MULTI_FAMILY", label: "Multi-Family" },
  { value: "RENTAL", label: "Rental" },
  { value: "NEW_CONSTRUCTION", label: "New Construction" },
];

const STATES_PROVINCES: { value: string; label: string; group: string }[] = [
  // US States
  { value: "AL", label: "Alabama", group: "US" },
  { value: "AK", label: "Alaska", group: "US" },
  { value: "AZ", label: "Arizona", group: "US" },
  { value: "AR", label: "Arkansas", group: "US" },
  { value: "CA", label: "California", group: "US" },
  { value: "CO", label: "Colorado", group: "US" },
  { value: "CT", label: "Connecticut", group: "US" },
  { value: "DE", label: "Delaware", group: "US" },
  { value: "FL", label: "Florida", group: "US" },
  { value: "GA", label: "Georgia", group: "US" },
  { value: "HI", label: "Hawaii", group: "US" },
  { value: "ID", label: "Idaho", group: "US" },
  { value: "IL", label: "Illinois", group: "US" },
  { value: "IN", label: "Indiana", group: "US" },
  { value: "IA", label: "Iowa", group: "US" },
  { value: "KS", label: "Kansas", group: "US" },
  { value: "KY", label: "Kentucky", group: "US" },
  { value: "LA", label: "Louisiana", group: "US" },
  { value: "ME", label: "Maine", group: "US" },
  { value: "MD", label: "Maryland", group: "US" },
  { value: "MA", label: "Massachusetts", group: "US" },
  { value: "MI", label: "Michigan", group: "US" },
  { value: "MN", label: "Minnesota", group: "US" },
  { value: "MS", label: "Mississippi", group: "US" },
  { value: "MO", label: "Missouri", group: "US" },
  { value: "MT", label: "Montana", group: "US" },
  { value: "NE", label: "Nebraska", group: "US" },
  { value: "NV", label: "Nevada", group: "US" },
  { value: "NH", label: "New Hampshire", group: "US" },
  { value: "NJ", label: "New Jersey", group: "US" },
  { value: "NM", label: "New Mexico", group: "US" },
  { value: "NY", label: "New York", group: "US" },
  { value: "NC", label: "North Carolina", group: "US" },
  { value: "ND", label: "North Dakota", group: "US" },
  { value: "OH", label: "Ohio", group: "US" },
  { value: "OK", label: "Oklahoma", group: "US" },
  { value: "OR", label: "Oregon", group: "US" },
  { value: "PA", label: "Pennsylvania", group: "US" },
  { value: "RI", label: "Rhode Island", group: "US" },
  { value: "SC", label: "South Carolina", group: "US" },
  { value: "SD", label: "South Dakota", group: "US" },
  { value: "TN", label: "Tennessee", group: "US" },
  { value: "TX", label: "Texas", group: "US" },
  { value: "UT", label: "Utah", group: "US" },
  { value: "VT", label: "Vermont", group: "US" },
  { value: "VA", label: "Virginia", group: "US" },
  { value: "WA", label: "Washington", group: "US" },
  { value: "WV", label: "West Virginia", group: "US" },
  { value: "WI", label: "Wisconsin", group: "US" },
  { value: "WY", label: "Wyoming", group: "US" },
  { value: "DC", label: "Washington DC", group: "US" },
  // Canadian Provinces & Territories
  { value: "AB", label: "Alberta", group: "CA" },
  { value: "BC", label: "British Columbia", group: "CA" },
  { value: "MB", label: "Manitoba", group: "CA" },
  { value: "NB", label: "New Brunswick", group: "CA" },
  { value: "NL", label: "Newfoundland & Labrador", group: "CA" },
  { value: "NS", label: "Nova Scotia", group: "CA" },
  { value: "NT", label: "Northwest Territories", group: "CA" },
  { value: "NU", label: "Nunavut", group: "CA" },
  { value: "ON", label: "Ontario", group: "CA" },
  { value: "PE", label: "Prince Edward Island", group: "CA" },
  { value: "QC", label: "Quebec", group: "CA" },
  { value: "SK", label: "Saskatchewan", group: "CA" },
  { value: "YT", label: "Yukon", group: "CA" },
];

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total, brandColor }: { current: Step; total: number; brandColor: string }) {
  const labels = ["Property", "Package", "Date & Time", "Your Info", "Review"];
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((label, i) => {
        const stepNum = (i + 1) as Step;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  !done && !active ? "bg-gray-100 text-gray-400" : "text-white"
                }`}
                style={
                  done
                    ? { backgroundColor: brandColor }
                    : active
                    ? { backgroundColor: brandColor, boxShadow: `0 0 0 4px ${brandColor}33` }
                    : undefined
                }
              >
                {done ? "✓" : stepNum}
              </div>
              <span
                className="text-xs hidden sm:block"
                style={active ? { color: brandColor, fontWeight: 500 } : { color: "#9ca3af" }}
              >
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div
                className="flex-1 h-0.5 mb-4"
                style={{ backgroundColor: done ? brandColor : "#e5e7eb" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Input Components ─────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
    />
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; group?: string }[];
  placeholder?: string;
}) {
  // Group options if any have a `group` field
  const hasGroups = options.some((o) => o.group);
  const groups = hasGroups
    ? Array.from(new Set(options.map((o) => o.group ?? ""))).filter(Boolean)
    : [];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {hasGroups
        ? groups.map((g) => (
            <optgroup key={g} label={g === "US" ? "🇺🇸 United States" : g === "CA" ? "🇨🇦 Canada" : g}>
              {options.filter((o) => o.group === g).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          ))
        : options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))
      }
    </select>
  );
}

// ─── Step 1: Property ─────────────────────────────────────────────────────────

function Step1Property({
  form,
  setForm,
  settings,
}: {
  form: FormData;
  setForm: (f: FormData) => void;
  settings: BookingFormSettings;
}) {
  const set = (key: keyof FormData) => (v: string) => setForm({ ...form, [key]: v });
  const f = settings.fields;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Property Details</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us about the property we'll be photographing.</p>
      </div>
      <Field label="Property Address" required>
        <AddressAutocomplete
          value={form.propertyAddress}
          onChange={set("propertyAddress")}
          onSelect={(result) =>
            setForm({
              ...form,
              propertyAddress: result.streetAddress || form.propertyAddress,
              propertyCity: result.city || form.propertyCity,
              propertyState: result.state || form.propertyState,
              propertyZip: result.zip || form.propertyZip,
              propertyLat: result.lat ?? null,
              propertyLng: result.lng ?? null,
            })
          }
          placeholder="123 Main St"
          required
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="City" required>
          <Input value={form.propertyCity} onChange={set("propertyCity")} placeholder="e.g. Toronto" required />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="State / Province" required>
            <Select
              value={form.propertyState}
              onChange={set("propertyState")}
              options={STATES_PROVINCES}
              placeholder="Select…"
            />
          </Field>
          <Field label="ZIP / Postal Code">
            <Input value={form.propertyZip} onChange={set("propertyZip")} placeholder="78701 or A1A 1A1" />
          </Field>
        </div>
      </div>
      {/* Map preview after address is selected (respects showMapPreview setting) */}
      {settings.showMapPreview !== false && form.propertyLat && form.propertyLng && (
        <MapboxMap
          center={{ lat: form.propertyLat, lng: form.propertyLng }}
          markers={[{ lat: form.propertyLat, lng: form.propertyLng, color: "#3B82F6" }]}
          height={200}
          zoom={15}
          interactive={false}
          showControls={false}
        />
      )}
      {f.propertyType.visible && (
        <Field label="Property Type" required={f.propertyType.required}>
          <Select value={form.propertyType} onChange={set("propertyType")} options={PROPERTY_TYPES} />
        </Field>
      )}
      {(f.sqft.visible || f.beds.visible || f.baths.visible) && (
        <div className="grid grid-cols-3 gap-3">
          {f.sqft.visible && (
            <Field label="Sq Ft" required={f.sqft.required}>
              <Input value={form.squareFootage} onChange={set("squareFootage")} placeholder="2,400" type="number" required={f.sqft.required} />
            </Field>
          )}
          {f.beds.visible && (
            <Field label="Beds" required={f.beds.required}>
              <Input value={form.bedrooms} onChange={set("bedrooms")} placeholder="3" type="number" required={f.beds.required} />
            </Field>
          )}
          {f.baths.visible && (
            <Field label="Baths" required={f.baths.required}>
              <Input value={form.bathrooms} onChange={set("bathrooms")} placeholder="2" type="number" required={f.baths.required} />
            </Field>
          )}
        </div>
      )}
      {f.mlsNumber.visible && (
        <Field label="MLS #" required={f.mlsNumber.required}>
          <Input value={form.mlsNumber} onChange={set("mlsNumber")} placeholder="Optional" required={f.mlsNumber.required} />
        </Field>
      )}
      {f.accessNotes.visible && (
        <Field label="Access Notes" hint="Lock box codes, gate codes, or special instructions for the photographer." required={f.accessNotes.required}>
          <textarea
            value={form.accessNotes}
            onChange={(e) => set("accessNotes")(e.target.value)}
            placeholder="e.g., Lock box on front door, code 1234. Dog-friendly yard."
            rows={3}
            required={f.accessNotes.required}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </Field>
      )}
    </div>
  );
}

// ─── Step 2: Package / À la carte ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PackageDetailModal({ pkg, brandColor, onSelect, onClose, services, toggleAddOn, selectedAddOns }: { pkg: any; brandColor: string; onSelect: () => void; onClose: () => void; services: any[]; toggleAddOn: (id: string) => void; selectedAddOns: string[] }) {
  const [modalTab, setModalTab] = useState<"setup" | "about">("setup");
  const pkgServiceIds = new Set((pkg.items ?? []).map((i: any) => i.serviceId ?? i.service?.id));
  const suggestedAddOns = services.filter((s: any) => !pkgServiceIds.has(s.id)).slice(0, 8);
  const [addOnScroll, setAddOnScroll] = useState(0);

  const svcIcon = (cat: string) =>
    cat === "PHOTOGRAPHY" ? "📸" : cat === "VIDEO" ? "🎬" : cat === "DRONE" ? "🚁" :
    cat === "VIRTUAL_TOUR_3D" ? "🏠" : cat === "FLOOR_PLAN" ? "📐" :
    cat === "VIRTUAL_STAGING" ? "🪄" : cat === "TWILIGHT" ? "🌅" :
    cat === "SOCIAL_MEDIA" ? "📱" : "📦";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[540px] max-h-[90vh] overflow-hidden flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="shrink-0 border-b border-gray-100">
          <div className="p-5 pb-0">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors -mt-1 -mr-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-white text-sm font-bold px-3 py-1 rounded-md" style={{ backgroundColor: brandColor }}>${pkg.price.toLocaleString()}</span>
              {pkg.items?.length > 0 && <span className="text-xs text-gray-500">{pkg.items.length} services</span>}
            </div>
            {pkg.description && <p className="text-sm text-gray-500 mt-3 leading-relaxed">{pkg.description}</p>}
            <div className="flex gap-0 mt-4 border-b border-gray-100 -mx-5 px-5">
              <button type="button" onClick={() => setModalTab("setup")}
                className={`pb-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${modalTab === "setup" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              >Package Setup</button>
              <button type="button" onClick={() => setModalTab("about")}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${modalTab === "about" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              >About Package</button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {modalTab === "setup" && (
            <div className="p-5">
              {pkg.items?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">In Package</h4>
                  <div className="space-y-1">
                    {pkg.items.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <span className="text-base">{svcIcon(item.service.category)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-sky-700 bg-sky-50">Core</span>
                          <p className="text-sm font-medium text-gray-900 mt-0.5">{item.service.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {suggestedAddOns.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">Suggested Add-ons</h4>
                    {suggestedAddOns.length > 3 && (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setAddOnScroll(Math.max(0, addOnScroll - 1))} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30" disabled={addOnScroll === 0}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button type="button" onClick={() => setAddOnScroll(Math.min(suggestedAddOns.length - 3, addOnScroll + 1))} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30" disabled={addOnScroll >= suggestedAddOns.length - 3}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex gap-3 transition-transform duration-300" style={{ transform: `translateX(-${addOnScroll * 170}px)` }}>
                      {suggestedAddOns.map((svc: any) => {
                        const isAdded = selectedAddOns.includes(svc.id);
                        return (
                          <div key={svc.id} className="w-[160px] shrink-0 rounded-xl border border-gray-200 overflow-hidden bg-white hover:shadow-md transition-shadow">
                            <div className="h-20 bg-gray-100 flex items-center justify-center relative">
                              <span className="text-2xl">{svcIcon(svc.category)}</span>
                              <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-orange-700 bg-orange-50">Add-on</span>
                            </div>
                            <div className="p-3">
                              <p className="text-xs font-semibold text-gray-900 leading-tight">{svc.name}</p>
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-sm font-bold text-gray-900">${svc.basePrice.toLocaleString()}</span>
                                <button type="button" onClick={() => toggleAddOn(svc.id)} className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: isAdded ? "#ef4444" : "#22c55e" }}>
                                  {isAdded ? "−" : "+"}
                                </button>
                              </div>
                              {svc.description && <p className="text-[11px] text-gray-400 mt-1.5 line-clamp-2">{svc.description}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {modalTab === "about" && (
            <div className="p-5 space-y-4">
              {pkg.description && <p className="text-sm text-gray-600 leading-relaxed">{pkg.description}</p>}
              {(pkg.photoCount || pkg.turnaroundDays) && (
                <div className="space-y-2">
                  {pkg.photoCount && <div className="flex items-center gap-2 text-sm text-gray-700"><span>📷</span> <span>{pkg.photoCount} photos included</span></div>}
                  {pkg.turnaroundDays && <div className="flex items-center gap-2 text-sm text-gray-700"><span>⏱</span> <span>{pkg.turnaroundDays} day{pkg.turnaroundDays !== 1 ? "s" : ""} delivery</span></div>}
                </div>
              )}
              {pkg.items?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Services included:</h4>
                  {pkg.items.map((item: any) => (
                    <p key={item.id} className="text-sm text-gray-600">{item.service.name}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-gray-100">
          <button type="button" onClick={() => { onSelect(); onClose(); }} style={{ backgroundColor: brandColor }} className="w-full py-3 text-sm font-bold text-white rounded-lg hover:opacity-90 transition-opacity">
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order Cart Sidebar ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OrderCart({ selectedPkg, selectedAddOns, selectedServiceIds, services, brandColor, onRemovePkg, onRemoveAddOn, onRemoveService }: {
  selectedPkg: any | null; selectedAddOns: string[]; selectedServiceIds: string[]; services: any[]; brandColor: string;
  onRemovePkg: () => void; onRemoveAddOn: (id: string) => void; onRemoveService: (id: string) => void;
}) {
  const addOnItems = services.filter((s: any) => selectedAddOns.includes(s.id));
  const serviceItems = services.filter((s: any) => selectedServiceIds.includes(s.id));
  const pkgPrice = selectedPkg?.price ?? 0;
  const addOnTotal = addOnItems.reduce((sum: number, s: any) => sum + s.basePrice, 0);
  const svcTotal = serviceItems.reduce((sum: number, s: any) => sum + s.basePrice, 0);
  const total = selectedPkg ? pkgPrice + addOnTotal : svcTotal;
  const hasItems = !!selectedPkg || serviceItems.length > 0;
  const itemCount = (selectedPkg ? 1 : 0) + addOnItems.length + (!selectedPkg ? serviceItems.length : 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-28">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Order details</h3>
        {itemCount > 0 && (
          <span className="text-[10px] font-bold text-white rounded-full w-5 h-5 flex items-center justify-center" style={{ backgroundColor: brandColor }}>
            {itemCount}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="px-5 py-3 space-y-0 max-h-[50vh] overflow-y-auto">
        {!hasItems && (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
            </div>
            <p className="text-xs text-gray-400">Select a package or services</p>
          </div>
        )}

        {selectedPkg && (
          <div className="flex items-center justify-between gap-2 py-3 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{selectedPkg.name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Package</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm font-bold text-gray-900">${pkgPrice.toLocaleString()}</span>
              <button type="button" onClick={onRemovePkg} className="w-5 h-5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors" title="Remove">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}

        {addOnItems.map((svc: any) => (
          <div key={svc.id} className="flex items-center justify-between gap-2 py-3 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">{svc.name}</p>
              <p className="text-[11px] font-medium mt-0.5" style={{ color: brandColor }}>Add-on</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm text-gray-600">${svc.basePrice.toLocaleString()}</span>
              <button type="button" onClick={() => onRemoveAddOn(svc.id)} className="w-5 h-5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors" title="Remove">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        ))}

        {!selectedPkg && serviceItems.map((svc: any) => (
          <div key={svc.id} className="flex items-center justify-between gap-2 py-3 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">{svc.name}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm text-gray-600">${svc.basePrice.toLocaleString()}</span>
              <button type="button" onClick={() => onRemoveService(svc.id)} className="w-5 h-5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors" title="Remove">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="px-5 py-4 border-t border-gray-100" style={{ backgroundColor: `${brandColor}08` }}>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Total</span>
          <span className="text-xl font-bold text-gray-900">${total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function Step2Package({
  form,
  setForm,
  packages,
  services,
  brandColor,
  gridColumns = 3,
}: {
  form: FormData;
  setForm: (f: FormData) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  packages: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  services: any[];
  brandColor: string;
  gridColumns?: number;
}) {
  const [tab, setTab] = useState<"packages" | "services">("packages");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailPkg, setDetailPkg] = useState<any | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const columns = gridColumns;

  const selectPackage = (pkgId: string) => {
    setForm({ ...form, packageId: pkgId, selectedServiceIds: [...selectedAddOns] });
  };

  const removePkg = () => {
    setForm({ ...form, packageId: "", selectedServiceIds: [] });
    setSelectedAddOns([]);
  };

  const toggleService = (serviceId: string) => {
    const current = form.selectedServiceIds;
    const next = current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId];
    setForm({ ...form, packageId: "", selectedServiceIds: next });
  };

  const removeService = (serviceId: string) => {
    setForm({ ...form, selectedServiceIds: form.selectedServiceIds.filter((id) => id !== serviceId) });
  };

  const toggleAddOn = (serviceId: string) => {
    setSelectedAddOns((prev) => {
      const next = prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId];
      if (form.packageId) setForm({ ...form, selectedServiceIds: next });
      return next;
    });
  };

  const removeAddOn = (serviceId: string) => {
    setSelectedAddOns((prev) => {
      const next = prev.filter((id) => id !== serviceId);
      if (form.packageId) setForm({ ...form, selectedServiceIds: next });
      return next;
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedPkg = packages.find((p: any) => p.id === form.packageId) ?? null;

  const svcIcon = (cat: string) =>
    cat === "PHOTOGRAPHY" ? "📸" : cat === "VIDEO" ? "🎬" : cat === "DRONE" ? "🚁" :
    cat === "VIRTUAL_TOUR_3D" ? "🏠" : cat === "FLOOR_PLAN" ? "📐" :
    cat === "VIRTUAL_STAGING" ? "🪄" : cat === "TWILIGHT" ? "🌅" :
    cat === "SOCIAL_MEDIA" ? "📱" : "📦";

  const gridClass =
    columns === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" :
    columns === 4 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" :
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="flex gap-6 items-start">
      {/* Left: Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Services</h2>
          <p className="text-sm text-gray-500 mt-0.5">Please choose your items below.</p>
        </div>

        {/* Tabs: Packages / Services */}
        <div className="flex gap-1">
          <button type="button" onClick={() => setTab("packages")}
            className={`px-5 py-2 text-sm font-semibold rounded-full border transition-colors ${tab === "packages" ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
            style={tab === "packages" ? { backgroundColor: brandColor } : undefined}
          >Packages</button>
          <button type="button" onClick={() => setTab("services")}
            className={`px-5 py-2 text-sm font-semibold rounded-full border transition-colors ${tab === "services" ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
            style={tab === "services" ? { backgroundColor: brandColor } : undefined}
          >
            Services
            {form.selectedServiceIds.length > 0 && !form.packageId && (
              <span className="ml-1.5 text-[10px] bg-white/30 px-1.5 py-0.5 rounded-full">{form.selectedServiceIds.length}</span>
            )}
          </button>
        </div>

        {/* ═══ Packages Grid ═══ */}
        {tab === "packages" && (
          <div className={`grid ${gridClass} gap-4`}>
            {packages.length === 0 ? (
              <div className="col-span-full text-center py-10 text-gray-400 text-sm">No packages available.</div>
            ) : (
              packages.map((pkg: any) => {
                const selected = form.packageId === pkg.id;
                return (
                  <div key={pkg.id} className={`relative rounded-xl overflow-hidden border bg-white transition-all group ${selected ? "" : "hover:shadow-lg"}`}
                    style={selected ? { borderColor: brandColor, boxShadow: `0 0 0 2px ${brandColor}33` } : { borderColor: "#e5e7eb" }}
                  >
                    {/* Cover */}
                    <div className="relative h-36 bg-gray-100 overflow-hidden cursor-pointer" onClick={() => selectPackage(pkg.id)}>
                      {pkg.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pkg.coverImage} alt={pkg.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(145deg, ${brandColor}15, ${brandColor}05)` }}>
                          <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                          </svg>
                        </div>
                      )}
                      {pkg.isPopular && (
                        <span className="absolute top-2 left-2 text-[10px] font-bold text-white px-2 py-0.5 rounded" style={{ backgroundColor: pkg.badgeColor || brandColor }}>
                          {pkg.badgeLabel || "Most Popular"}
                        </span>
                      )}
                      {selected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: brandColor }}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-3">
                      <h3 className="font-bold text-gray-900 text-sm">{pkg.name}</h3>
                      {pkg.items?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                          {pkg.items.slice(0, 4).map((item: any) => (
                            <span key={item.id} className="text-[11px] text-gray-500 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: brandColor }} />
                              {item.service.name}
                            </span>
                          ))}
                          {pkg.items.length > 4 && <span className="text-[11px] text-gray-400">+{pkg.items.length - 4} more</span>}
                        </div>
                      )}
                      <button type="button" onClick={(e) => { e.stopPropagation(); setDetailPkg(pkg); }} className="mt-2 text-xs font-semibold" style={{ color: brandColor }}>
                        View Details
                      </button>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                        <span className="text-base font-bold text-gray-900">${pkg.price.toLocaleString()}</span>
                        <button type="button" onClick={() => selectPackage(pkg.id)}
                          className={`px-3 py-1 text-xs font-semibold rounded border transition-colors ${selected ? "text-white border-transparent" : "text-gray-700 border-gray-300 hover:border-gray-400 bg-white"}`}
                          style={selected ? { backgroundColor: brandColor } : undefined}
                        >{selected ? "Selected" : "Add"}</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══ Services Grid ═══ */}
        {tab === "services" && (
          <div className={`grid ${gridClass} gap-3`}>
            {services.length === 0 ? (
              <div className="col-span-full text-center py-10 text-gray-400 text-sm">No individual services available.</div>
            ) : (
              services.map((svc: any) => {
                const selected = form.selectedServiceIds.includes(svc.id) && !form.packageId;
                return (
                  <div key={svc.id} className={`rounded-xl border bg-white overflow-hidden transition-all ${selected ? "" : "hover:shadow-sm"}`}
                    style={selected ? { borderColor: brandColor, boxShadow: `0 0 0 1px ${brandColor}44` } : { borderColor: "#f3f4f6" }}
                  >
                    {/* Icon header */}
                    <div className="h-20 bg-gray-50 flex items-center justify-center">
                      <span className="text-2xl">{svcIcon(svc.category)}</span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-gray-900">{svc.name}</p>
                      {svc.description && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{svc.description}</p>}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                        <span className="text-sm font-bold text-gray-900">${svc.basePrice.toLocaleString()}</span>
                        <button type="button" onClick={() => toggleService(svc.id)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: selected ? "#ef4444" : "#22c55e" }}
                        >{selected ? "−" : "+"}</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Right: Order Cart sidebar */}
      <div className="w-[280px] shrink-0 hidden lg:block">
        <OrderCart
          selectedPkg={selectedPkg}
          selectedAddOns={selectedAddOns}
          selectedServiceIds={form.selectedServiceIds}
          services={services}
          brandColor={brandColor}
          onRemovePkg={removePkg}
          onRemoveAddOn={removeAddOn}
          onRemoveService={removeService}
        />
      </div>

      {/* Mobile: sticky bottom cart summary */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-white border-t border-gray-200 shadow-lg px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <p className="text-sm font-bold text-gray-900">
              {selectedPkg ? selectedPkg.name : `${form.selectedServiceIds.length} item${form.selectedServiceIds.length !== 1 ? "s" : ""}`}
            </p>
            <p className="text-xs text-gray-500">
              {selectedAddOns.length > 0 && selectedPkg ? `+ ${selectedAddOns.length} add-on${selectedAddOns.length !== 1 ? "s" : ""}` : ""}
            </p>
          </div>
          <span className="text-lg font-bold text-gray-900">
            ${(selectedPkg
              ? selectedPkg.price + services.filter((s: any) => selectedAddOns.includes(s.id)).reduce((sum: number, s: any) => sum + s.basePrice, 0)
              : services.filter((s: any) => form.selectedServiceIds.includes(s.id)).reduce((sum: number, s: any) => sum + s.basePrice, 0)
            ).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Detail Modal */}
      {detailPkg && (
        <PackageDetailModal
          pkg={detailPkg}
          brandColor={brandColor}
          services={services}
          selectedAddOns={selectedAddOns}
          toggleAddOn={toggleAddOn}
          onSelect={() => selectPackage(detailPkg.id)}
          onClose={() => setDetailPkg(null)}
        />
      )}
    </div>
  );
}
// ─── Step 3: Date & Time + Photographer ───────────────────────────────────────

function Step3DateTime({
  form,
  setForm,
  workspaceSlug,
  brandColor,
  hours,
}: {
  form: FormData;
  setForm: (f: FormData) => void;
  workspaceSlug: string;
  brandColor: string;
  hours: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }[];
}) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i + 1));

  // Build a map of day-of-week → hours config for quick lookup
  const hoursByDay = Object.fromEntries(hours.map((h) => [h.dayOfWeek, h]));

  // Fetch available photographers when a date is chosen
  const { data: photographersData, isLoading: photographersLoading } =
    trpc.booking.getAvailablePhotographers.useQuery(
      { slug: workspaceSlug, date: form.scheduledDate },
      { enabled: !!form.scheduledDate }
    );
  const photographers = photographersData?.photographers ?? [];

  // Auto-select photographer if only one is available
  useEffect(() => {
    if (photographers.length === 1 && !form.photographerId) {
      setForm({ ...form, photographerId: photographers[0].staffProfileId });
    }
    // If previously selected photographer is no longer available, clear them
    if (
      form.photographerId &&
      photographers.length > 0 &&
      !photographers.find((p) => p.staffProfileId === form.photographerId)
    ) {
      setForm({ ...form, photographerId: "", scheduledTime: "" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photographers]);

  const selectedPhotographer = photographers.find(
    (p) => p.staffProfileId === form.photographerId
  );

  // Fetch booked slots (filtered to selected photographer if one is chosen)
  const { data: slotsData } = trpc.booking.getBookedSlots.useQuery(
    {
      slug: workspaceSlug,
      date: form.scheduledDate,
      staffProfileId: form.photographerId || undefined,
    },
    { enabled: !!form.scheduledDate }
  );

  // Build set of blocked times
  const blockedTimes = new Set<string>();
  slotsData?.bookedSlots?.forEach((slot) => {
    if (slot.scheduledAt) {
      const d = new Date(slot.scheduledAt);
      blockedTimes.add(
        `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
      );
    }
  });

  // Generate time slots based on workspace business hours for the selected day
  const selectedDayOfWeek = form.scheduledDate
    ? new Date(`${form.scheduledDate}T12:00:00`).getDay()
    : null;
  const todayHours =
    selectedDayOfWeek !== null && hoursByDay[selectedDayOfWeek]
      ? hoursByDay[selectedDayOfWeek]
      : null;
  const baseSlots =
    todayHours && todayHours.isOpen
      ? generateTimeSlots(todayHours.openTime, todayHours.closeTime)
      : generateTimeSlots("09:00", "17:00"); // fallback if no hours configured

  // Filter to photographer's available window if one is selected
  const visibleSlots = baseSlots.filter((slot) => {
    if (!selectedPhotographer) return true;
    return slot.value >= selectedPhotographer.startTime && slot.value < selectedPhotographer.endTime;
  });

  const showPhotographerSection =
    !!form.scheduledDate && (photographersLoading || photographers.length > 0);

  // Need photographer selected (if photographers exist) before showing times
  const showTimeSection =
    !!form.scheduledDate &&
    (photographers.length === 0 || !!form.photographerId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Pick a Date & Time</h2>
        <p className="text-sm text-gray-500 mt-1">Choose when you'd like us to come out.</p>
      </div>

      {/* Calendar grid */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Select a date</p>
        <div className="grid grid-cols-7 gap-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center text-xs text-gray-400 pb-1 font-medium">{d}</div>
          ))}
          {Array.from({ length: days[0].getDay() }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map((day) => {
            const iso = format(day, "yyyy-MM-dd");
            const selected = form.scheduledDate === iso;
            const past = isBefore(day, today);
            const dow = day.getDay();
            const dayConfig = hoursByDay[dow];
            const closed = dayConfig ? !dayConfig.isOpen : false;
            const disabled = past || closed;
            return (
              <button
                key={iso}
                type="button"
                disabled={disabled}
                onClick={() =>
                  setForm({ ...form, scheduledDate: iso, scheduledTime: "", photographerId: "" })
                }
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all ${
                  selected
                    ? "text-white font-semibold"
                    : disabled
                    ? "text-gray-200 cursor-not-allowed"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                style={selected ? { backgroundColor: brandColor } : undefined}
              >
                <span>{day.getDate()}</span>
                {isToday(day) && !selected && (
                  <span className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: brandColor }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Photographer selection */}
      {showPhotographerSection && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Choose your photographer
          </p>
          {photographersLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              Checking availability…
            </div>
          ) : photographers.length === 0 ? (
            <p className="text-sm text-gray-400">No photographers available on this date.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photographers.map((p) => {
                const selected = form.photographerId === p.staffProfileId;
                return (
                  <button
                    key={p.staffProfileId}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, photographerId: p.staffProfileId, scheduledTime: "" })
                    }
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all bg-white ${
                      !selected ? "border-gray-200 hover:border-gray-300" : ""
                    }`}
                    style={
                      selected
                        ? { borderColor: brandColor, boxShadow: `0 0 0 3px ${brandColor}22` }
                        : undefined
                    }
                  >
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.avatarUrl}
                        alt={p.name ?? ""}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                        style={{ backgroundColor: brandColor }}
                      >
                        {(p.name ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-medium text-gray-800 text-center leading-tight">
                      {p.name}
                    </span>
                    {selected && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: brandColor }}
                      >
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Time slots */}
      {showTimeSection && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Available times · {format(new Date(`${form.scheduledDate}T12:00:00`), "EEEE, MMMM d")}
          </p>
          {visibleSlots.length === 0 ? (
            <p className="text-sm text-gray-400">No time slots available for this selection.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {visibleSlots.map((slot) => {
                const blocked = blockedTimes.has(slot.value);
                const selected = form.scheduledTime === slot.value;
                return (
                  <button
                    key={slot.value}
                    type="button"
                    disabled={blocked}
                    onClick={() => setForm({ ...form, scheduledTime: slot.value })}
                    className={`py-2 px-3 rounded-lg text-sm border transition-all ${
                      selected
                        ? "text-white font-medium"
                        : blocked
                        ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed line-through"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                    style={
                      selected ? { backgroundColor: brandColor, borderColor: brandColor } : undefined
                    }
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Contact Info ─────────────────────────────────────────────────────

function Step4Contact({
  form,
  setForm,
  settings,
}: {
  form: FormData;
  setForm: (f: FormData) => void;
  settings: BookingFormSettings;
}) {
  const set = (key: keyof FormData) => (v: string) => setForm({ ...form, [key]: v });
  const f = settings.fields;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Your Contact Info</h2>
        <p className="text-sm text-gray-500 mt-1">We'll send the confirmation and updates here.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name" required>
          <Input value={form.firstName} onChange={set("firstName")} placeholder="Jane" required />
        </Field>
        <Field label="Last Name" required>
          <Input value={form.lastName} onChange={set("lastName")} placeholder="Smith" required />
        </Field>
      </div>

      <Field label="Email" required>
        <Input value={form.email} onChange={set("email")} placeholder="jane@realty.com" type="email" required />
      </Field>
      {f.phone.visible && (
        <Field label="Phone" required={f.phone.required}>
          <Input value={form.phone} onChange={set("phone")} placeholder="(512) 555-0100" type="tel" required={f.phone.required} />
        </Field>
      )}
      {f.company.visible && (
        <Field label="Company / Brokerage" required={f.company.required}>
          <Input value={form.company} onChange={set("company")} placeholder="Austin Premier Realty" required={f.company.required} />
        </Field>
      )}
      {f.clientNotes.visible && (
        <Field label="Notes for us" hint="Anything specific you'd like us to know about the shoot." required={f.clientNotes.required}>
          <textarea
            value={form.clientNotes}
            onChange={(e) => set("clientNotes")(e.target.value)}
            placeholder="e.g., Please focus on the backyard pool. The kitchen was just renovated."
            rows={3}
            required={f.clientNotes.required}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </Field>
      )}
    </div>
  );
}

// ─── Custom Fields Renderer ──────────────────────────────────────────────────

function CustomFieldsRenderer({
  step,
  fields,
  values,
  onChange,
}: {
  step: number;
  fields: CustomField[];
  values: Record<string, string | string[] | boolean>;
  onChange: (v: Record<string, string | string[] | boolean>) => void;
}) {
  const stepFields = fields
    .filter((f) => f.step === step)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (stepFields.length === 0) return null;

  const setValue = (id: string, val: string | string[] | boolean) => {
    onChange({ ...values, [id]: val });
  };

  return (
    <div className="space-y-4 mt-6 pt-6 border-t border-gray-100">
      {stepFields.map((field) => {
        const val = values[field.id];

        // Description — read-only text block
        if (field.type === "description") {
          return (
            <div key={field.id} className="rounded-lg bg-blue-50 border border-blue-100 p-4">
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{field.helpText || field.label}</p>
            </div>
          );
        }

        // Checkbox
        if (field.type === "checkbox") {
          return (
            <label key={field.id} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={!!val}
                onChange={(e) => setValue(field.id, e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </span>
                {field.helpText && <p className="text-xs text-gray-400 mt-0.5">{field.helpText}</p>}
              </div>
            </label>
          );
        }

        // All other fields wrapped in Field component
        return (
          <Field key={field.id} label={field.label} required={field.required} hint={field.helpText || undefined}>
            {field.type === "text" && (
              <Input
                value={(val as string) ?? ""}
                onChange={(v) => setValue(field.id, v)}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}
            {field.type === "number" && (
              <Input
                value={(val as string) ?? ""}
                onChange={(v) => setValue(field.id, v)}
                placeholder={field.placeholder}
                type="number"
                required={field.required}
              />
            )}
            {field.type === "date" && (
              <Input
                value={(val as string) ?? ""}
                onChange={(v) => setValue(field.id, v)}
                type="date"
                required={field.required}
              />
            )}
            {field.type === "textarea" && (
              <textarea
                value={(val as string) ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                required={field.required}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            )}
            {field.type === "dropdown" && (
              <select
                value={(val as string) ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.required}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">{field.placeholder || "Select..."}</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
            {field.type === "select" && (
              <div className="space-y-2">
                {(field.options ?? []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={field.id}
                      value={opt}
                      checked={val === opt}
                      onChange={() => setValue(field.id, opt)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            )}
            {field.type === "multiselect" && (
              <div className="space-y-2">
                {(field.options ?? []).map((opt) => {
                  const selected = Array.isArray(val) ? val : [];
                  const checked = selected.includes(opt);
                  return (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? selected.filter((v) => v !== opt)
                            : [...selected, opt];
                          setValue(field.id, next);
                        }}
                        className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </Field>
        );
      })}
    </div>
  );
}

// ─── Step 5: Review ───────────────────────────────────────────────────────────

function Step5Review({
  form,
  packages,
  services,
  photographers,
}: {
  form: FormData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  packages: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  services: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  photographers: any[];
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pkg = packages.find((p: any) => p.id === form.packageId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedServices = services.filter((s: any) => form.selectedServiceIds.includes(s.id));
  const alaCarteTotal = selectedServices.reduce((sum: number, s: any) => sum + s.basePrice, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photographer = photographers.find((p: any) => p.staffProfileId === form.photographerId);
  const scheduledDisplay =
    form.scheduledDate && form.scheduledTime
      ? format(
          new Date(`${form.scheduledDate}T${form.scheduledTime}`),
          "EEEE, MMMM d, yyyy 'at' h:mm aa"
        )
      : "—";

  const rows = [
    { label: "Property", value: `${form.propertyAddress}, ${form.propertyCity}, ${form.propertyState}` },
    { label: "Type", value: PROPERTY_TYPES.find((t) => t.value === form.propertyType)?.label ?? form.propertyType },
    { label: "Size", value: form.squareFootage ? `${Number(form.squareFootage).toLocaleString()} sq ft` : "—" },
    { label: "Bedrooms / Baths", value: form.bedrooms ? `${form.bedrooms} bd / ${form.bathrooms || "—"} ba` : "—" },
    {
      label: pkg ? "Package" : "Services",
      value: pkg
        ? `${pkg.name} — $${pkg.price.toLocaleString()}`
        : selectedServices.length > 0
          ? `${selectedServices.map((s: any) => s.name).join(", ")} — $${alaCarteTotal.toLocaleString()}`
          : "None selected",
    },
    { label: "Appointment", value: scheduledDisplay },
    ...(photographer ? [{ label: "Photographer", value: photographer.name }] : []),
    { label: "Name", value: `${form.firstName} ${form.lastName}` },
    { label: "Email", value: form.email },
    { label: "Phone", value: form.phone || "—" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Review Your Booking</h2>
        <p className="text-sm text-gray-500 mt-1">Everything look right? Hit Book to confirm.</p>
      </div>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`flex gap-4 px-4 py-3 text-sm ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
          >
            <span className="w-36 shrink-0 text-gray-500">{row.label}</span>
            <span className="text-gray-900 font-medium">{row.value}</span>
          </div>
        ))}
      </div>
      {/* Map preview on review step */}
      {form.propertyLat && form.propertyLng && (
        <MapboxMap
          center={{ lat: form.propertyLat, lng: form.propertyLng }}
          markers={[{ lat: form.propertyLat, lng: form.propertyLng, color: "#3B82F6" }]}
          height={160}
          zoom={14}
          interactive={false}
          showControls={false}
        />
      )}
      {form.accessNotes && (
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
          <span className="font-medium">Access notes:</span> {form.accessNotes}
        </div>
      )}
      {form.clientNotes && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
          <span className="font-medium">Your notes:</span> {form.clientNotes}
        </div>
      )}
      <p className="text-xs text-gray-400 text-center">
        By clicking Book, you agree to our standard cancellation policy. You'll receive a confirmation email shortly.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceSlug = params?.workspaceSlug as string;
  const formId = searchParams.get("form") ?? undefined;

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [error, setError] = useState<string | null>(null);

  // ── Live designer state (overrides from postMessage) ─────────────────────
  const [liveFieldSettings, setLiveFieldSettings] = useState<BookingFormSettings["fields"] | null>(null);
  const [liveCustomFields, setLiveCustomFields] = useState<CustomField[] | null>(null);
  const [liveGridColumns, setLiveGridColumns] = useState<number | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | string[] | boolean>>({});

  // ── Listen for designer postMessages ─────────────────────────────────────
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "DESIGNER_SET_STEP" && typeof e.data.step === "number") {
        const s = e.data.step as Step;
        if (s >= 1 && s <= 5) setStep(s);
      }
      if (e.data?.type === "DESIGNER_LIVE_UPDATE") {
        if (e.data.fieldSettings) setLiveFieldSettings(e.data.fieldSettings);
        if (e.data.customFields) setLiveCustomFields(e.data.customFields);
        if (e.data.gridColumns != null) setLiveGridColumns(e.data.gridColumns);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const { data, isLoading, isError } = trpc.booking.getWorkspaceInfo.useQuery(
    { slug: workspaceSlug, formId },
    { enabled: !!workspaceSlug }
  );

  // Pre-fetch photographers for selected date (used in Step 5 review)
  const { data: reviewPhotographersData } = trpc.booking.getAvailablePhotographers.useQuery(
    { slug: workspaceSlug, date: form.scheduledDate },
    { enabled: !!form.scheduledDate && step === 5 }
  );
  const reviewPhotographers = reviewPhotographersData?.photographers ?? [];

  const submitMutation = trpc.booking.submit.useMutation({
    onSuccess: (result) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectedPkg = data?.packages?.find((p: any) => p.id === form.packageId);
      const pkgName = selectedPkg?.name ?? "";
      router.push(
        `/book/${workspaceSlug}/success?job=${result.jobNumber}&name=${encodeURIComponent(result.clientName)}&date=${encodeURIComponent(result.scheduledAt)}&pkg=${encodeURIComponent(pkgName)}`
      );
    },
    onError: (err) => {
      setError(err.message ?? "Something went wrong. Please try again.");
    },
  });

  // Validate each step before advancing
  const canAdvance = (): boolean => {
    setError(null);
    if (step === 1) {
      if (!form.propertyAddress.trim()) return !!setError("Property address is required.");
      if (!form.propertyCity.trim()) return !!setError("City is required.");
      if (!form.propertyState) return !!setError("State / Province is required.");
      return true;
    }
    if (step === 2) {
      if (!form.packageId && form.selectedServiceIds.length === 0) {
        return !!setError("Please select a package or at least one service to continue.");
      }
      return true;
    }
    if (step === 3) {
      if (!form.scheduledDate) return !!setError("Please select a date.");
      if (!form.scheduledTime) return !!setError("Please select a time slot.");
      return true;
    }
    if (step === 4) {
      if (!form.firstName.trim()) return !!setError("First name is required.");
      if (!form.lastName.trim()) return !!setError("Last name is required.");
      if (!form.email.trim()) return !!setError("Email is required.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return !!setError("Enter a valid email.");
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (canAdvance()) setStep((s) => (s + 1) as Step);
  };

  const handleSubmit = () => {
    setError(null);
    submitMutation.mutate({
      slug: workspaceSlug,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || undefined,
      company: form.company || undefined,
      propertyAddress: form.propertyAddress,
      propertyCity: form.propertyCity,
      propertyState: form.propertyState,
      propertyZip: form.propertyZip || undefined,
      propertyType: form.propertyType as
        | "RESIDENTIAL"
        | "COMMERCIAL"
        | "LAND"
        | "MULTI_FAMILY"
        | "RENTAL"
        | "NEW_CONSTRUCTION",
      squareFootage: form.squareFootage ? Number(form.squareFootage) : undefined,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
      mlsNumber: form.mlsNumber || undefined,
      accessNotes: form.accessNotes || undefined,
      propertyLat: form.propertyLat ?? undefined,
      propertyLng: form.propertyLng ?? undefined,
      packageId: form.packageId || undefined,
      serviceIds: form.selectedServiceIds.length > 0 ? form.selectedServiceIds : undefined,
      staffProfileId: form.photographerId || undefined,
      scheduledAt: new Date(`${form.scheduledDate}T${form.scheduledTime}`).toISOString(),
      clientNotes: form.clientNotes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="text-5xl">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900">Booking page not found</h1>
        <p className="text-gray-500 max-w-sm">This booking link doesn't exist or has been disabled. Please check the URL or contact the company directly.</p>
      </div>
    );
  }

  const { workspace, packages, services } = data;
  const brandColor = workspace.brandColor ?? "#1B4F9E";
  // Prefer per-form field settings (when ?form= is set), fall back to workspace-level settings
  const rawSettings = data?.orderForm?.fieldSettings ?? workspace.bookingFormSettings;
  // DB stores field objects flat (e.g. { propertyType: {...}, sqft: {...}, gridColumns: 3 })
  // Detect flat format: if rawSettings has field keys at root but no "fields" wrapper, lift them
  const baseSettings: BookingFormSettings = rawSettings
    ? (() => {
        const rs = rawSettings as any;
        // If already in BookingFormSettings shape (has a "fields" sub-object)
        if (rs.fields && typeof rs.fields === "object" && rs.fields.propertyType) {
          return { ...DEFAULT_BOOKING_FORM_SETTINGS, ...rs, fields: { ...DEFAULT_BOOKING_FORM_SETTINGS.fields, ...rs.fields } };
        }
        // Flat shape from DB — field objects are at root level alongside gridColumns etc.
        const { gridColumns: gc, welcomeMessage, showMapPreview, ...fieldObjs } = rs;
        return {
          ...DEFAULT_BOOKING_FORM_SETTINGS,
          ...(gc != null && { gridColumns: gc }),
          ...(welcomeMessage != null && { welcomeMessage }),
          ...(showMapPreview != null && { showMapPreview }),
          fields: { ...DEFAULT_BOOKING_FORM_SETTINGS.fields, ...fieldObjs },
        };
      })()
    : DEFAULT_BOOKING_FORM_SETTINGS;
  // Live designer overrides field settings in real-time
  const formSettings: BookingFormSettings = liveFieldSettings
    ? { ...baseSettings, fields: liveFieldSettings }
    : baseSettings;
  // Custom fields: live override > saved on form > empty
  const customFields: CustomField[] = liveCustomFields
    ?? ((data?.orderForm as any)?.customFields as CustomField[] | undefined)
    ?? [];

  // Grid columns: live override > saved in fieldSettings > default 3
  const gridColumns = liveGridColumns
    ?? (rawSettings as any)?.gridColumns
    ?? 3;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Brand accent bar + Header */}
      <div className="h-1 sticky top-0 z-20" style={{ backgroundColor: brandColor }} />
      <header className="bg-white border-b border-gray-100 py-4 px-6 sticky top-1 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {workspace.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={workspace.logoUrl} alt={workspace.name} className="h-8 w-auto object-contain" />
          ) : (
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {workspace.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div>
            <h1 className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">{workspace.name}</h1>
            <p className="text-xs text-gray-400 leading-tight">Book a shoot</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className={`mx-auto px-4 py-8 transition-all ${step === 2 ? "max-w-6xl" : "max-w-2xl"}`}>
        <StepIndicator current={step} total={5} brandColor={brandColor} />

        {/* Step 2 gets its own wider layout (no card wrapper) */}
        {step === 2 && (
          <div>
            <Step2Package form={form} setForm={setForm} packages={packages} services={services ?? []} brandColor={brandColor} gridColumns={gridColumns} />
            <div className="mt-4">
              <CustomFieldsRenderer step={2} fields={customFields} values={customFieldValues} onChange={setCustomFieldValues} />
            </div>
          </div>
        )}

        <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 ${step === 2 ? "hidden" : ""}`}>
          {step === 1 && (
            <>
              <Step1Property form={form} setForm={setForm} settings={formSettings} />
              <CustomFieldsRenderer step={1} fields={customFields} values={customFieldValues} onChange={setCustomFieldValues} />
            </>
          )}
          {step === 3 && (
            <>
              <Step3DateTime form={form} setForm={setForm} workspaceSlug={workspaceSlug} brandColor={brandColor} hours={data?.workspace?.hours ?? []} />
              <CustomFieldsRenderer step={3} fields={customFields} values={customFieldValues} onChange={setCustomFieldValues} />
            </>
          )}
          {step === 4 && (
            <>
              <Step4Contact form={form} setForm={setForm} settings={formSettings} />
              <CustomFieldsRenderer step={4} fields={customFields} values={customFieldValues} onChange={setCustomFieldValues} />
            </>
          )}
          {step === 5 && (
            <>
              <Step5Review form={form} packages={packages} services={services ?? []} photographers={reviewPhotographers} />
              <CustomFieldsRenderer step={5} fields={customFields} values={customFieldValues} onChange={setCustomFieldValues} />
            </>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between gap-4">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                style={{ backgroundColor: brandColor }}
                className="px-6 py-2.5 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                style={{ backgroundColor: brandColor }}
                className="px-8 py-2.5 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
              >
                {submitMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Booking...
                  </>
                ) : (
                  "📅 Book Now"
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          {workspace.name}
          {workspace.email && (
            <> · <a href={`mailto:${workspace.email}`} className="underline hover:text-gray-600 transition-colors">{workspace.email}</a></>
          )}
        </p>
      </main>
    </div>
  );
}

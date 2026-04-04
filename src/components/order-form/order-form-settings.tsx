"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/trpc/client";
import { Loader2, Save, Eye, EyeOff, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { DEFAULT_BOOKING_FORM_SETTINGS, type BookingFormSettings } from "@/server/routers/workspace";

type FieldKey = keyof BookingFormSettings["fields"];

interface FieldConfig {
  key: FieldKey;
  label: string;
  description: string;
  section: "property" | "contact";
  alwaysVisible?: boolean;
}

const FIELD_CONFIGS: FieldConfig[] = [
  // Property fields
  { key: "propertyType", label: "Property Type",   description: "Residential, Commercial, Land, etc.",     section: "property" },
  { key: "sqft",         label: "Square Footage",   description: "Total square footage of the property",    section: "property" },
  { key: "beds",         label: "Bedrooms",          description: "Number of bedrooms",                       section: "property" },
  { key: "baths",        label: "Bathrooms",         description: "Number of bathrooms",                      section: "property" },
  { key: "mlsNumber",   label: "MLS Number",        description: "Optional MLS listing number",              section: "property" },
  { key: "accessNotes", label: "Access Notes",      description: "Lock box codes, gate info, special instructions", section: "property" },
  // Contact fields
  { key: "phone",        label: "Phone Number",      description: "Client's phone number",                    section: "contact" },
  { key: "company",      label: "Company / Brokerage", description: "Client's company or brokerage name",     section: "contact" },
  { key: "clientNotes",  label: "Order Notes",       description: "Any special requests or notes from client", section: "contact" },
];

function deepMerge(defaults: BookingFormSettings, saved: Partial<BookingFormSettings>): BookingFormSettings {
  return {
    welcomeMessage: saved.welcomeMessage ?? defaults.welcomeMessage,
    fields: {
      ...defaults.fields,
      ...saved.fields,
    },
  };
}

export function OrderFormSettings({ workspaceSlug }: { workspaceSlug: string }) {
  const { data, isLoading } = api.workspace.getBookingFormSettings.useQuery();
  const saveMutation = api.workspace.saveBookingFormSettings.useMutation();

  const [settings, setSettings] = useState<BookingFormSettings>(DEFAULT_BOOKING_FORM_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setSettings(deepMerge(DEFAULT_BOOKING_FORM_SETTINGS, data.settings));
    }
  }, [data]);

  function setField(key: FieldKey, prop: "visible" | "required", value: boolean) {
    setSettings((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [key]: {
          ...prev.fields[key],
          [prop]: value,
          // If hiding a field, also un-require it
          ...(prop === "visible" && !value ? { required: false } : {}),
        },
      },
    }));
    setSaved(false);
  }

  async function handleSave() {
    await saveMutation.mutateAsync(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const bookingUrl = `https://www.scalist.io/book/${workspaceSlug}`;

  const propertyFields = FIELD_CONFIGS.filter((f) => f.section === "property");
  const contactFields  = FIELD_CONFIGS.filter((f) => f.section === "contact");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header card */}
      <div className="bg-white rounded-xl border p-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Booking Form</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Control which fields appear on your client-facing booking page.
          </p>
        </div>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Preview form <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Welcome message */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Welcome Message</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Shown at the top of your booking page. Leave blank to hide.
          </p>
        </div>
        <textarea
          value={settings.welcomeMessage ?? ""}
          onChange={(e) => { setSettings((p) => ({ ...p, welcomeMessage: e.target.value })); setSaved(false); }}
          placeholder="e.g. We're excited to photograph your property! Please complete the form below to get started."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
        />
      </div>

      {/* Property fields */}
      <FieldSection
        title="Property Details"
        description="Shown on Step 1 — the property information form"
        fields={propertyFields}
        settings={settings}
        onToggle={setField}
      />

      {/* Contact fields */}
      <FieldSection
        title="Contact Information"
        description="Shown on Step 4 — the client contact form"
        fields={contactFields}
        settings={settings}
        onToggle={setField}
      />

      {/* Save bar */}
      <div className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4">
        <p className="text-xs text-gray-500">
          Changes apply immediately to your live booking page.
        </p>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {saveMutation.isError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {saveMutation.error?.message ?? "Failed to save. Please try again."}
        </div>
      )}
    </div>
  );
}

function FieldSection({
  title, description, fields, settings, onToggle,
}: {
  title: string;
  description: string;
  fields: FieldConfig[];
  settings: BookingFormSettings;
  onToggle: (key: FieldKey, prop: "visible" | "required", value: boolean) => void;
}) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-5 py-4 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_80px] items-center px-5 py-2 border-b bg-gray-50/50">
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Field</span>
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider text-center">Show</span>
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider text-center">Required</span>
      </div>

      <div className="divide-y">
        {fields.map((f) => {
          const cfg = settings.fields[f.key];
          return (
            <div key={f.key} className="grid grid-cols-[1fr_80px_80px] items-center px-5 py-3.5">
              {/* Label */}
              <div>
                <p className={`text-sm font-medium ${cfg.visible ? "text-gray-900" : "text-gray-400"}`}>
                  {f.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{f.description}</p>
              </div>

              {/* Visible toggle */}
              <div className="flex justify-center">
                <Toggle
                  value={cfg.visible}
                  onChange={(v) => onToggle(f.key, "visible", v)}
                  icon={cfg.visible ? Eye : EyeOff}
                  onColor="bg-blue-600"
                />
              </div>

              {/* Required toggle — disabled when hidden */}
              <div className="flex justify-center">
                <Toggle
                  value={cfg.required}
                  onChange={(v) => onToggle(f.key, "required", v)}
                  disabled={!cfg.visible}
                  onColor="bg-orange-500"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({
  value, onChange, disabled = false, onColor = "bg-blue-600",
  icon: Icon,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  onColor?: string;
  icon?: React.ElementType;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
        disabled ? "opacity-30 cursor-not-allowed bg-gray-200" : value ? onColor : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

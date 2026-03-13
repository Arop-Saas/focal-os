"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { format, addDays, startOfDay, isToday, isBefore } from "date-fns";

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
  // Step 2 – Package
  packageId: string;
  // Step 3 – Date/Time
  scheduledDate: string; // "YYYY-MM-DD"
  scheduledTime: string; // "HH:MM"
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
  packageId: "",
  scheduledDate: "",
  scheduledTime: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  clientNotes: "",
};

// Generate 30-min time slots from 8am to 6pm
const TIME_SLOTS = Array.from({ length: 21 }, (_, i) => {
  const totalMins = 8 * 60 + i * 30;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const label = `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  return { label, value };
});

// Property type labels
const PROPERTY_TYPES = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "LAND", label: "Land / Lot" },
  { value: "MULTI_FAMILY", label: "Multi-Family" },
  { value: "RENTAL", label: "Rental" },
  { value: "NEW_CONSTRUCTION", label: "New Construction" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: Step; total: number }) {
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
                  done
                    ? "bg-green-500 text-white"
                    : active
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? "✓" : stepNum}
              </div>
              <span
                className={`text-xs hidden sm:block ${
                  active ? "text-blue-600 font-medium" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div
                className={`flex-1 h-0.5 mb-4 ${done ? "bg-green-400" : "bg-gray-200"}`}
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
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Step 1: Property ─────────────────────────────────────────────────────────

function Step1Property({ form, setForm }: { form: FormData; setForm: (f: FormData) => void }) {
  const set = (key: keyof FormData) => (v: string) => setForm({ ...form, [key]: v });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Property Details</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us about the property we'll be photographing.</p>
      </div>
      <Field label="Property Address" required>
        <Input value={form.propertyAddress} onChange={set("propertyAddress")} placeholder="123 Main St" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City" required>
          <Input value={form.propertyCity} onChange={set("propertyCity")} placeholder="Austin" required />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="State" required>
            <Select
              value={form.propertyState}
              onChange={set("propertyState")}
              options={US_STATES.map((s) => ({ value: s, label: s }))}
              placeholder="State"
            />
          </Field>
          <Field label="ZIP">
            <Input value={form.propertyZip} onChange={set("propertyZip")} placeholder="78701" />
          </Field>
        </div>
      </div>
      <Field label="Property Type">
        <Select value={form.propertyType} onChange={set("propertyType")} options={PROPERTY_TYPES} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Sq Footage">
          <Input value={form.squareFootage} onChange={set("squareFootage")} placeholder="2,400" type="number" />
        </Field>
        <Field label="Bedrooms">
          <Input value={form.bedrooms} onChange={set("bedrooms")} placeholder="3" type="number" />
        </Field>
        <Field label="Bathrooms">
          <Input value={form.bathrooms} onChange={set("bathrooms")} placeholder="2" type="number" />
        </Field>
      </div>
      <Field label="MLS #">
        <Input value={form.mlsNumber} onChange={set("mlsNumber")} placeholder="Optional" />
      </Field>
      <Field label="Access Notes" hint="Lock box codes, gate codes, or special instructions for the photographer.">
        <textarea
          value={form.accessNotes}
          onChange={(e) => set("accessNotes")(e.target.value)}
          placeholder="e.g., Lock box on front door, code 1234. Dog-friendly yard."
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </Field>
    </div>
  );
}

// ─── Step 2: Package ──────────────────────────────────────────────────────────

function Step2Package({
  form,
  setForm,
  packages,
}: {
  form: FormData;
  setForm: (f: FormData) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  packages: any[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Choose a Package</h2>
        <p className="text-sm text-gray-500 mt-1">Select the services that best fit your listing.</p>
      </div>
      {packages.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No packages available at this time. Please contact us directly.</div>
      ) : (
        <div className="space-y-3">
          {packages.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (pkg: any) => {
              const selected = form.packageId === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setForm({ ...form, packageId: pkg.id })}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selected
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{pkg.name}</span>
                        {pkg.isPopular && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            Most Popular
                          </span>
                        )}
                      </div>
                      {pkg.description && (
                        <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                      )}
                      {pkg.items?.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {pkg.items.map((item: any) => (
                            <li
                              key={item.id}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                            >
                              {item.service.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xl font-bold text-gray-900">
                        ${pkg.price.toLocaleString()}
                      </div>
                      <div
                        className={`w-5 h-5 mt-2 ml-auto rounded-full border-2 flex items-center justify-center ${
                          selected ? "border-blue-500 bg-blue-500" : "border-gray-300"
                        }`}
                      >
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Date & Time ──────────────────────────────────────────────────────

function Step3DateTime({
  form,
  setForm,
  workspaceSlug,
}: {
  form: FormData;
  setForm: (f: FormData) => void;
  workspaceSlug: string;
}) {
  // Show a 4-week rolling calendar
  const today = startOfDay(new Date());
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i + 1));

  const { data: slotsData } = trpc.booking.getBookedSlots.useQuery(
    { slug: workspaceSlug, date: form.scheduledDate },
    { enabled: !!form.scheduledDate }
  );

  // Build set of blocked start hours
  const blockedTimes = new Set<string>();
  slotsData?.bookedSlots?.forEach((slot) => {
    if (slot.scheduledAt) {
      const d = new Date(slot.scheduledAt);
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      blockedTimes.add(`${hh}:${mm}`);
    }
  });

  const selectedDay = form.scheduledDate
    ? new Date(`${form.scheduledDate}T00:00:00`)
    : null;

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
          {/* Empty cells for first row alignment */}
          {Array.from({ length: days[0].getDay() }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map((day) => {
            const iso = format(day, "yyyy-MM-dd");
            const selected = form.scheduledDate === iso;
            const past = isBefore(day, today);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <button
                key={iso}
                type="button"
                disabled={past}
                onClick={() => setForm({ ...form, scheduledDate: iso, scheduledTime: "" })}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-all ${
                  selected
                    ? "bg-blue-600 text-white font-semibold"
                    : past
                    ? "text-gray-200 cursor-not-allowed"
                    : isWeekend
                    ? "text-blue-700 hover:bg-blue-50"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span>{day.getDate()}</span>
                {isToday(day) && !selected && (
                  <span className="w-1 h-1 rounded-full bg-blue-400 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {form.scheduledDate && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Available times · {format(new Date(`${form.scheduledDate}T12:00:00`), "EEEE, MMMM d")}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map((slot) => {
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
                      ? "bg-blue-600 border-blue-600 text-white font-medium"
                      : blocked
                      ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed line-through"
                      : "border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700"
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Contact Info ─────────────────────────────────────────────────────

function Step4Contact({ form, setForm }: { form: FormData; setForm: (f: FormData) => void }) {
  const set = (key: keyof FormData) => (v: string) => setForm({ ...form, [key]: v });
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
      <Field label="Phone">
        <Input value={form.phone} onChange={set("phone")} placeholder="(512) 555-0100" type="tel" />
      </Field>
      <Field label="Company / Brokerage">
        <Input value={form.company} onChange={set("company")} placeholder="Austin Premier Realty" />
      </Field>
      <Field label="Notes for us" hint="Anything specific you'd like us to know about the shoot.">
        <textarea
          value={form.clientNotes}
          onChange={(e) => set("clientNotes")(e.target.value)}
          placeholder="e.g., Please focus on the backyard pool. The kitchen was just renovated."
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </Field>
    </div>
  );
}

// ─── Step 5: Review ───────────────────────────────────────────────────────────

function Step5Review({
  form,
  packages,
}: {
  form: FormData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  packages: any[];
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pkg = packages.find((p: any) => p.id === form.packageId);
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
    { label: "Package", value: pkg ? `${pkg.name} — $${pkg.price.toLocaleString()}` : "No package selected" },
    { label: "Appointment", value: scheduledDisplay },
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
  const workspaceSlug = params?.workspaceSlug as string;

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = trpc.booking.getWorkspaceInfo.useQuery(
    { slug: workspaceSlug },
    { enabled: !!workspaceSlug }
  );

  const submitMutation = trpc.booking.submit.useMutation({
    onSuccess: (result) => {
      router.push(
        `/book/${workspaceSlug}/success?job=${result.jobNumber}&name=${encodeURIComponent(result.clientName)}&date=${encodeURIComponent(result.scheduledAt)}`
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
      if (!form.propertyState) return !!setError("State is required.");
      return true;
    }
    if (step === 2) {
      if (!form.packageId && data?.packages?.length && data.packages.length > 0) {
        return !!setError("Please select a package to continue.");
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
      packageId: form.packageId || undefined,
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

  const { workspace, packages } = data;
  const brandColor = workspace.brandColor ?? "#1B4F9E";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {workspace.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={workspace.logoUrl} alt={workspace.name} className="h-8 w-auto" />
          )}
          <div>
            <h1 className="font-semibold text-gray-900 text-sm sm:text-base">{workspace.name}</h1>
            <p className="text-xs text-gray-400">Real Estate Photography</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <StepIndicator current={step} total={5} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          {step === 1 && <Step1Property form={form} setForm={setForm} />}
          {step === 2 && <Step2Package form={form} setForm={setForm} packages={packages} />}
          {step === 3 && (
            <Step3DateTime form={form} setForm={setForm} workspaceSlug={workspaceSlug} />
          )}
          {step === 4 && <Step4Contact form={form} setForm={setForm} />}
          {step === 5 && <Step5Review form={form} packages={packages} />}

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
          Powered by FocalOS · Questions?{" "}
          {workspace.email && (
            <a href={`mailto:${workspace.email}`} className="underline">
              {workspace.email}
            </a>
          )}
        </p>
      </main>
    </div>
  );
}

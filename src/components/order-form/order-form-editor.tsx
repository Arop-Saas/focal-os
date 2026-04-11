"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import {
  Loader2, Save, CheckCircle2, ExternalLink, ArrowLeft,
  Eye, EyeOff, Globe, Lock, Clock, Users, CreditCard, ClipboardList,
  MapPin, Check, X,
} from "lucide-react";
import { DEFAULT_BOOKING_FORM_SETTINGS, type BookingFormSettings } from "@/lib/booking-form-types";

type FieldKey = keyof BookingFormSettings["fields"];

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

// ─── Toggle component ────────────────────────────────────────────────────────

function Toggle({ value, onChange, color = "blue" }: { value: boolean; onChange: (v: boolean) => void; color?: "blue" | "orange" }) {
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

// ─── Section card ────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, desc, children }: {
  icon: React.ElementType;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-blue-500 shrink-0" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 ml-6">{desc}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Save button with states ─────────────────────────────────────────────────

function SaveButton({ onClick, loading, saved }: { onClick: () => void; loading: boolean; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
      style={{ backgroundColor: saved ? "#16a34a" : "#2563eb", color: "white" }}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> :
       saved   ? <CheckCircle2 className="w-4 h-4" /> :
                 <Save className="w-4 h-4" />}
      {loading ? "Saving…" : saved ? "Saved!" : "Save"}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OrderFormEditor({ formId, workspaceSlug }: { formId: string; workspaceSlug: string }) {
  const router = useRouter();
  const { data: form, isLoading } = api.orderForm.get.useQuery({ id: formId });

  const updateGeneral   = api.orderForm.updateGeneral.useMutation();
  const updateFields    = api.orderForm.updateFields.useMutation();
  const updateScheduling = api.orderForm.updateScheduling.useMutation();
  const updatePayment   = api.orderForm.updatePayment.useMutation();
  const updateTerritories = api.orderForm.updateTerritories.useMutation();

  // Territory linking
  const { data: allTerritories } = api.territories.list.useQuery();

  // ── Local state ────────────────────────────────────────────────────────────
  const [title, setTitle]             = useState("");
  const [welcomeMsg, setWelcomeMsg]   = useState("");
  const [isPublic, setIsPublic]       = useState(true);
  const [fields, setFields]           = useState<BookingFormSettings["fields"]>(DEFAULT_BOOKING_FORM_SETTINGS.fields);
  const [confirmMode, setConfirmMode] = useState<"IMMEDIATE" | "MANUAL">("IMMEDIATE");
  const [assignStrat, setAssignStrat] = useState<"ROUND_ROBIN" | "CLOSEST" | "PRIORITY" | "AUTO">("ROUND_ROBIN");
  const [allowChoice, setAllowChoice] = useState(false);
  const [slotInterval, setSlotInterval] = useState(30);
  const [paymentMode, setPaymentMode] = useState<"NONE" | "FULL" | "PARTIAL">("NONE");
  const [deposit, setDeposit]         = useState(25);

  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState<string[]>([]);

  const [savedGeneral, setSavedGeneral]     = useState(false);
  const [savedFields, setSavedFields]       = useState(false);
  const [savedScheduling, setSavedScheduling] = useState(false);
  const [savedPayment, setSavedPayment]     = useState(false);
  const [savedTerritories, setSavedTerritories] = useState(false);

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

    if (form.fieldSettings) {
      setFields({ ...DEFAULT_BOOKING_FORM_SETTINGS.fields, ...(form.fieldSettings as BookingFormSettings["fields"]) });
    }
    if ((form as any).territories) {
      setSelectedTerritoryIds((form as any).territories.map((t: any) => t.id));
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!form) return null;

  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io"}/book/${workspaceSlug}?form=${formId}`;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Back */}
      <button
        onClick={() => router.push("/order-form")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> All forms
      </button>

      {/* ── 1. General ──────────────────────────────────────────────────────── */}
      <Section icon={ClipboardList} title="General Settings" desc="Name and welcome message for this form">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Form Title</label>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setSavedGeneral(false); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Standard Booking Form"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Welcome Message <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={welcomeMsg}
              onChange={(e) => { setWelcomeMsg(e.target.value); setSavedGeneral(false); }}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Shown at the top of your booking page…"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm font-medium text-gray-700">Public visibility</p>
              <p className="text-xs text-gray-400">When public, this form appears on your booking page</p>
            </div>
            <Toggle value={isPublic} onChange={(v) => { setIsPublic(v); setSavedGeneral(false); }} />
          </div>
          <div className="flex justify-end">
            <SaveButton
              loading={updateGeneral.isPending}
              saved={savedGeneral}
              onClick={async () => {
                await updateGeneral.mutateAsync({ id: formId, title, welcomeMessage: welcomeMsg, isPublic });
                setSavedGeneral(true);
                setTimeout(() => setSavedGeneral(false), 3000);
              }}
            />
          </div>
        </div>
      </Section>

      {/* ── 1b. Territories ───────────────────────────────────────────────── */}
      {allTerritories && allTerritories.length > 0 && (
        <Section icon={MapPin} title="Service Territories" desc="Restrict this form to specific territories — only allow bookings within these areas">
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              {selectedTerritoryIds.length === 0
                ? "No territory restrictions — bookings accepted from any address."
                : `${selectedTerritoryIds.length} territor${selectedTerritoryIds.length !== 1 ? "ies" : "y"} linked — bookings outside these areas will be blocked.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {allTerritories.map((t: any) => {
                const isSelected = selectedTerritoryIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTerritoryIds((prev) =>
                        isSelected ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                      );
                      setSavedTerritories(false);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      isSelected
                        ? "border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                        : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color ?? "#3B82F6" }} />
                    {isSelected && <Check className="w-3 h-3" />}
                    {t.name}
                  </button>
                );
              })}
            </div>
            {selectedTerritoryIds.length > 0 && (
              <button
                type="button"
                onClick={() => { setSelectedTerritoryIds([]); setSavedTerritories(false); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Clear all (allow any address)
              </button>
            )}
            <div className="flex justify-end pt-1">
              <SaveButton
                loading={updateTerritories.isPending}
                saved={savedTerritories}
                onClick={async () => {
                  await updateTerritories.mutateAsync({ id: formId, territoryIds: selectedTerritoryIds });
                  setSavedTerritories(true);
                  setTimeout(() => setSavedTerritories(false), 3000);
                }}
              />
            </div>
          </div>
        </Section>
      )}

      {/* ── 2. Preview link ─────────────────────────────────────────────────── */}
      <Section icon={ExternalLink} title="Booking Link" desc="Share this URL with clients or embed it on your website">
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={bookingUrl}
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none"
          />
          <button
            onClick={() => navigator.clipboard.writeText(bookingUrl)}
            className="px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Copy
          </button>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View
          </a>
        </div>
      </Section>

      {/* ── 3. Field settings ───────────────────────────────────────────────── */}
      <Section icon={ClipboardList} title="Form Fields" desc="Control which fields are shown and which are required">
        <div className="space-y-4">
          {/* Property */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Property Fields</p>
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_56px_64px] gap-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                <span>Field</span><span className="text-center">Show</span><span className="text-center">Required</span>
              </div>
              {PROPERTY_FIELDS.map(({ key, label, desc }) => (
                <div key={key} className="grid grid-cols-[1fr_56px_64px] gap-2 items-center px-2 py-2 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="text-sm text-gray-700">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <div className="flex justify-center">
                    <Toggle value={fields[key].visible} onChange={(v) => setField(key, "visible", v)} />
                  </div>
                  <div className="flex justify-center">
                    <Toggle
                      value={fields[key].required}
                      onChange={(v) => setField(key, "required", v)}
                      color="orange"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contact Fields</p>
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_56px_64px] gap-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                <span>Field</span><span className="text-center">Show</span><span className="text-center">Required</span>
              </div>
              {CONTACT_FIELDS.map(({ key, label, desc }) => (
                <div key={key} className="grid grid-cols-[1fr_56px_64px] gap-2 items-center px-2 py-2 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="text-sm text-gray-700">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <div className="flex justify-center">
                    <Toggle value={fields[key].visible} onChange={(v) => setField(key, "visible", v)} />
                  </div>
                  <div className="flex justify-center">
                    <Toggle
                      value={fields[key].required}
                      onChange={(v) => setField(key, "required", v)}
                      color="orange"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <p className="text-xs text-gray-400">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> Show</span>
              {" · "}
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> Required</span>
            </p>
            <SaveButton
              loading={updateFields.isPending}
              saved={savedFields}
              onClick={async () => {
                await updateFields.mutateAsync({ id: formId, fieldSettings: fields });
                setSavedFields(true);
                setTimeout(() => setSavedFields(false), 3000);
              }}
            />
          </div>
        </div>
      </Section>

      {/* ── 4. Scheduling ───────────────────────────────────────────────────── */}
      <Section icon={Clock} title="Scheduling Settings" desc="Control how appointments are confirmed and assigned">
        <div className="space-y-5">
          {/* Confirmation */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Appointment Confirmation</p>
            <div className="space-y-2">
              {(["IMMEDIATE", "MANUAL"] as const).map((mode) => (
                <label key={mode} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${confirmMode === mode ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-200"}`}>
                  <input type="radio" name="confirm" checked={confirmMode === mode} onChange={() => { setConfirmMode(mode); setSavedScheduling(false); }} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{mode === "IMMEDIATE" ? "Immediate" : "Requires Your Confirmation"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {mode === "IMMEDIATE"
                        ? "Appointment is confirmed automatically when the client books."
                        : "Client picks a preferred time but you must manually confirm it."}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Time slot interval */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Time Slot Interval</p>
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
          </div>

          {/* Staff assignment */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Staff Assignment Strategy</p>
            <div className="space-y-2">
              {([
                { val: "AUTO",        label: "Auto (Recommended)",  desc: "Best match based on availability and distance" },
                { val: "ROUND_ROBIN", label: "Round Robin",          desc: "Evenly distribute orders across your team" },
                { val: "CLOSEST",     label: "Closest Team Member",  desc: "Assign the team member nearest the property" },
                { val: "PRIORITY",    label: "Priority List",        desc: "Always try your top-priority staff first" },
              ] as const).map(({ val, label, desc }) => (
                <label key={val} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${assignStrat === val ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-200"}`}>
                  <input type="radio" name="assign" checked={assignStrat === val} onChange={() => { setAssignStrat(val); setSavedScheduling(false); }} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Customer choice */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Allow customer to choose photographer</p>
              <p className="text-xs text-gray-400">Overrides assignment strategy when customer selects someone</p>
            </div>
            <Toggle value={allowChoice} onChange={(v) => { setAllowChoice(v); setSavedScheduling(false); }} />
          </div>

          <div className="flex justify-end">
            <SaveButton
              loading={updateScheduling.isPending}
              saved={savedScheduling}
              onClick={async () => {
                await updateScheduling.mutateAsync({ id: formId, confirmationMode: confirmMode, assignmentStrategy: assignStrat, allowCustomerChoice: allowChoice, timeSlotInterval: slotInterval });
                setSavedScheduling(true);
                setTimeout(() => setSavedScheduling(false), 3000);
              }}
            />
          </div>
        </div>
      </Section>

      {/* ── 5. Payment ─────────────────────────────────────────────────────── */}
      <Section icon={CreditCard} title="Payment Settings" desc="Require payment at the time of booking">
        <div className="space-y-3">
          {([
            { val: "NONE",    label: "No Upfront Payment",       desc: "Clients can book without paying. Invoice separately." },
            { val: "FULL",    label: "Require Full Payment",      desc: "Client must pay the full balance to place an order." },
            { val: "PARTIAL", label: "Require Deposit",           desc: "Client must pay a percentage upfront to place an order." },
          ] as const).map(({ val, label, desc }) => (
            <label key={val} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${paymentMode === val ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-200"}`}>
              <input type="radio" name="payment" checked={paymentMode === val} onChange={() => { setPaymentMode(val); setSavedPayment(false); }} className="mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                {val === "PARTIAL" && paymentMode === "PARTIAL" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={deposit}
                      onChange={(e) => { setDeposit(Number(e.target.value)); setSavedPayment(false); }}
                      className="w-20 px-2 py-1 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500">% deposit required</span>
                  </div>
                )}
              </div>
            </label>
          ))}

          <div className="flex justify-end pt-1">
            <SaveButton
              loading={updatePayment.isPending}
              saved={savedPayment}
              onClick={async () => {
                await updatePayment.mutateAsync({
                  id: formId,
                  paymentMode,
                  depositPercent: paymentMode === "PARTIAL" ? deposit : null,
                });
                setSavedPayment(true);
                setTimeout(() => setSavedPayment(false), 3000);
              }}
            />
          </div>
        </div>
      </Section>

    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Check, Loader2, Pencil, Search, X } from "lucide-react";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";

/**
 * Inline editing for an order's identity: address, client, property facts.
 * All writes go through jobs.updateDetails; address changes clear the
 * coordinates so the page re-geocodes on next load.
 */

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-600">×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

// ─── Address ─────────────────────────────────────────────────────────────────

export function EditAddressButton({
  jobId,
  address,
  unit,
  city,
  state,
  zip,
}: {
  jobId: string;
  address: string;
  unit: string | null;
  city: string;
  state: string;
  zip: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ address, unit: unit ?? "", city, state, zip: zip ?? "" });

  const update = trpc.jobs.updateDetails.useMutation({
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const save = () => {
    if (!form.address.trim() || !form.city.trim() || !form.state.trim() || update.isPending) return;
    update.mutate({
      jobId,
      propertyAddress: form.address.trim(),
      propertyUnit: form.unit.trim() || null,
      propertyCity: form.city.trim(),
      propertyState: form.state.trim(),
      propertyZip: form.zip.trim() || null,
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Edit address"
        title="Edit address"
        className="rounded p-1 text-gray-300 transition-colors hover:text-gray-600"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {open && (
        <Modal title="Edit property address" onClose={() => setOpen(false)}>
          <div className="space-y-3 p-5">
            <div>
              <label className={labelCls}>Street address</label>
              <AddressAutocomplete
                value={form.address}
                onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                onSelect={(r) => {
                  setForm((f) => ({
                    ...f,
                    address: r.streetAddress || f.address,
                    city: r.city || f.city,
                    state: r.state || f.state,
                    zip: r.zip || f.zip,
                  }));
                }}
                placeholder="123 Oak Street"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Unit</label>
                <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>State</label>
                <input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="w-32">
              <label className={labelCls}>Zip</label>
              <input value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} className={inputCls} />
            </div>
            {update.error && <p className="text-xs text-red-600">{update.error.message}</p>}
          </div>
          <div className="flex gap-3 border-t p-5">
            <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={update.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save address"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Property facts ──────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "LAND", label: "Land" },
  { value: "MULTI_FAMILY", label: "Multi-Family" },
  { value: "RENTAL", label: "Rental" },
  { value: "NEW_CONSTRUCTION", label: "New Construction" },
] as const;

export function EditPropertyButton({
  jobId,
  propertyType,
  squareFootage,
  bedrooms,
  bathrooms,
  accessNotes,
}: {
  jobId: string;
  propertyType: string;
  squareFootage: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  accessNotes: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: propertyType,
    sqft: squareFootage != null ? String(squareFootage) : "",
    beds: bedrooms != null ? String(bedrooms) : "",
    baths: bathrooms != null ? String(bathrooms) : "",
    access: accessNotes ?? "",
  });

  const update = trpc.jobs.updateDetails.useMutation({
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const numOrNull = (v: string) => {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) ? n : null;
  };

  const save = () => {
    if (update.isPending) return;
    update.mutate({
      jobId,
      propertyType: form.type as (typeof PROPERTY_TYPES)[number]["value"],
      squareFootage: numOrNull(form.sqft) != null ? Math.round(numOrNull(form.sqft)!) : null,
      bedrooms: numOrNull(form.beds) != null ? Math.round(numOrNull(form.beds)!) : null,
      bathrooms: numOrNull(form.baths),
      accessNotes: form.access.trim() || null,
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[12px] font-medium text-blue-600 transition-colors hover:text-blue-700"
      >
        Edit
      </button>

      {open && (
        <Modal title="Edit property details" onClose={() => setOpen(false)}>
          <div className="space-y-3 p-5">
            <div>
              <label className={labelCls}>Property type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={cn(inputCls, "bg-white")}>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Sq ft</label>
                <input type="number" value={form.sqft} onChange={(e) => setForm((f) => ({ ...f, sqft: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Beds</label>
                <input type="number" value={form.beds} onChange={(e) => setForm((f) => ({ ...f, beds: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Baths</label>
                <input type="number" step="0.5" value={form.baths} onChange={(e) => setForm((f) => ({ ...f, baths: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Access notes</label>
              <textarea
                rows={2}
                value={form.access}
                onChange={(e) => setForm((f) => ({ ...f, access: e.target.value }))}
                placeholder="Lockbox code, entry instructions…"
                className={cn(inputCls, "resize-none")}
              />
            </div>
            {update.error && <p className="text-xs text-red-600">{update.error.message}</p>}
          </div>
          <div className="flex gap-3 border-t p-5">
            <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={update.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

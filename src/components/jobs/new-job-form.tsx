"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Plus, X, Search } from "lucide-react";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";

const schema = z.object({
  clientId: z.string().min(1, "Select a client"),
  packageId: z.string().optional(),
  propertyAddress: z.string().min(5, "Enter the property address"),
  propertyUnit: z.string().optional(),
  propertyCity: z.string().min(1, "Enter the city"),
  propertyState: z.string().min(1, "Enter the state"),
  propertyZip: z.string().optional(),
  propertyType: z.enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "MULTI_FAMILY", "RENTAL", "NEW_CONSTRUCTION"]).default("RESIDENTIAL"),
  squareFootage: z.coerce.number().optional(),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  mlsNumber: z.string().optional(),
  accessNotes: z.string().optional(),
  scheduledAt: z.string().optional(),
  estimatedDurationMins: z.coerce.number().default(90),
  internalNotes: z.string().optional(),
  clientNotes: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  priorityFee: z.coerce.number().default(0),
  assignedStaffIds: z.array(z.string()).default([]),
});
type FormData = z.infer<typeof schema>;

type Client = { id: string; firstName: string; lastName: string; email: string; company: string | null };
type Package = { id: string; name: string; price: number; items: { service: { name: string } }[] };
type Service = { id: string; name: string; category: string; basePrice: number };
type Staff = { id: string; member: { user: { fullName: string } } };

interface SelectedService {
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface NewJobFormProps {
  clients: Client[];
  packages: Package[];
  services: Service[];
  staff: Staff[];
  defaultClientId?: string;
}

const PROPERTY_TYPES = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "LAND", label: "Land" },
  { value: "MULTI_FAMILY", label: "Multi-Family" },
  { value: "RENTAL", label: "Rental" },
  { value: "NEW_CONSTRUCTION", label: "New Construction" },
];

const inputCls = "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white";
const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

// Searchable service picker
function ServicePicker({
  services,
  selected,
  onAdd,
}: {
  services: Service[];
  selected: SelectedService[];
  onAdd: (s: Service) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = services.filter(
    (s) =>
      !selected.some((sel) => sel.serviceId === s.id) &&
      (s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add service
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services…"
              className="flex-1 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                {search ? "No matches" : "All services added"}
              </p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { onAdd(s); setSearch(""); setOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-gray-800 font-medium">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.category}</p>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{formatCurrency(s.basePrice)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NewJobForm({ clients, packages, services, staff, defaultClientId }: NewJobFormProps) {
  const router = useRouter();
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);

  const createJob = trpc.jobs.create.useMutation({
    onSuccess: (job) => router.push(`/jobs/${job.id}`),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: defaultClientId ?? "",
      priority: "NORMAL",
      priorityFee: 0,
      estimatedDurationMins: 90,
      propertyType: "RESIDENTIAL",
    },
  });

  const selectedPackageId = watch("packageId");
  const priority = watch("priority");
  const pkg = packages.find((p) => p.id === selectedPackageId);

  function addService(s: Service) {
    setSelectedServices((prev) => [
      ...prev,
      { serviceId: s.id, name: s.name, quantity: 1, unitPrice: s.basePrice },
    ]);
  }

  function removeService(serviceId: string) {
    setSelectedServices((prev) => prev.filter((s) => s.serviceId !== serviceId));
  }

  function updateServiceQty(serviceId: string, qty: number) {
    setSelectedServices((prev) =>
      prev.map((s) => (s.serviceId === serviceId ? { ...s, quantity: Math.max(1, qty) } : s))
    );
  }

  function updateServicePrice(serviceId: string, price: number) {
    setSelectedServices((prev) =>
      prev.map((s) => (s.serviceId === serviceId ? { ...s, unitPrice: price } : s))
    );
  }

  function toggleStaff(id: string) {
    setSelectedStaff((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  async function onSubmit(data: FormData) {
    await createJob.mutateAsync({
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      services: selectedServices.map((s) => ({
        serviceId: s.serviceId,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
      })),
      assignedStaffIds: selectedStaff,
    });
  }

  const showPriorityFee = priority === "HIGH" || priority === "URGENT";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-5">
      {createJob.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {createJob.error.message}
        </div>
      )}

      {/* ── 1. Client & Scheduling ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm">Job details</h3>

        {/* Client */}
        <div>
          <label className={labelCls}>Client <span className="text-red-500">*</span></label>
          <select {...register("clientId")} className={inputCls}>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}{c.company ? ` — ${c.company}` : ""}
              </option>
            ))}
          </select>
          {errors.clientId && <p className="mt-1 text-xs text-red-600">{errors.clientId.message}</p>}
        </div>

        {/* Date + Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Scheduled date &amp; time</label>
            <input {...register("scheduledAt")} type="datetime-local" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Est. duration (mins)</label>
            <input {...register("estimatedDurationMins")} type="number" min={15} step={15} className={inputCls} />
          </div>
        </div>

        {/* Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Priority</label>
            <select {...register("priority")} className={inputCls}>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          {showPriorityFee && (
            <div>
              <label className={labelCls}>Priority fee ($)</label>
              <input
                {...register("priorityFee")}
                type="number"
                min={0}
                step={10}
                placeholder="0"
                className={inputCls}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Services ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm">Services</h3>

        {/* Package picker */}
        <div>
          <label className={labelCls}>Package (optional)</label>
          <select {...register("packageId")} className={inputCls}>
            <option value="">No package — select services individually</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatCurrency(p.price)}
              </option>
            ))}
          </select>
        </div>

        {pkg && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-700">
            <strong>{pkg.name}</strong> includes:{" "}
            {pkg.items.map((i) => i.service.name).join(", ")}
          </div>
        )}

        {/* Individual services */}
        {!pkg && (
          <div className="space-y-2">
            {selectedServices.length > 0 && (
              <div className="space-y-2">
                {/* header */}
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide px-1">
                  <span className="col-span-5">Service</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-3 text-right">Price</span>
                  <span className="col-span-2 text-right">Total</span>
                </div>
                {selectedServices.map((s) => (
                  <div key={s.serviceId} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeService(s.serviceId)}
                        className="p-0.5 text-gray-300 hover:text-red-400 rounded transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm text-gray-800 truncate">{s.name}</span>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min={1}
                        value={s.quantity}
                        onChange={(e) => updateServiceQty(s.serviceId, Number(e.target.value))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={s.unitPrice}
                        onChange={(e) => updateServicePrice(s.serviceId, Number(e.target.value))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-2 text-right text-sm font-medium text-gray-700">
                      {formatCurrency(s.quantity * s.unitPrice)}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-1 border-t text-sm font-semibold text-gray-800">
                  Total: {formatCurrency(selectedServices.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0))}
                </div>
              </div>
            )}
            <ServicePicker services={services} selected={selectedServices} onAdd={addService} />
          </div>
        )}
      </div>

      {/* ── 3. Property ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm">Property</h3>

        {/* Address row: street + unit */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Street address <span className="text-red-500">*</span></label>
            <AddressAutocomplete
              value={watch("propertyAddress") ?? ""}
              onChange={(v) => setValue("propertyAddress", v, { shouldValidate: true })}
              onSelect={(result) => {
                if (result.streetAddress) setValue("propertyAddress", result.streetAddress, { shouldValidate: true });
                if (result.city) setValue("propertyCity", result.city, { shouldValidate: true });
                if (result.state) setValue("propertyState", result.state, { shouldValidate: true });
                if (result.zip) setValue("propertyZip", result.zip);
              }}
              placeholder="123 Oak Street"
            />
            {errors.propertyAddress && <p className="mt-1 text-xs text-red-600">{errors.propertyAddress.message}</p>}
          </div>
          <div>
            <label className={labelCls}>Unit / Suite</label>
            <input {...register("propertyUnit")} placeholder="Apt 4B" className={inputCls} />
          </div>
        </div>

        {/* City / State / Zip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className={labelCls}>City <span className="text-red-500">*</span></label>
            <input {...register("propertyCity")} placeholder="Nashville" className={inputCls} />
            {errors.propertyCity && <p className="mt-1 text-xs text-red-600">{errors.propertyCity.message}</p>}
          </div>
          <div>
            <label className={labelCls}>State <span className="text-red-500">*</span></label>
            <input {...register("propertyState")} placeholder="TN" className={inputCls} />
            {errors.propertyState && <p className="mt-1 text-xs text-red-600">{errors.propertyState.message}</p>}
          </div>
          <div>
            <label className={labelCls}>Zip</label>
            <input {...register("propertyZip")} placeholder="37201" className={inputCls} />
          </div>
        </div>

        {/* Property type + details */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Type</label>
            <select {...register("propertyType")} className={inputCls}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Sq ft</label>
            <input {...register("squareFootage")} type="number" placeholder="2,400" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Beds</label>
            <input {...register("bedrooms")} type="number" placeholder="3" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Baths</label>
            <input {...register("bathrooms")} type="number" step="0.5" placeholder="2.5" className={inputCls} />
          </div>
        </div>

        {/* MLS + Access notes */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>MLS number</label>
            <input {...register("mlsNumber")} placeholder="MLS-12345" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Access notes</label>
          <textarea
            {...register("accessNotes")}
            rows={2}
            placeholder="Lockbox code, gate code, parking instructions…"
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      {/* ── 4. Assign staff ──────────────────────────────────────────────── */}
      {staff.length > 0 && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Assign photographer</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {staff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleStaff(s.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  selectedStaff.includes(s.id)
                    ? "bg-blue-50 border-blue-400 text-blue-700"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-600 text-xs font-bold shrink-0">
                  {s.member.user.fullName.charAt(0)}
                </div>
                <span className="truncate">{s.member.user.fullName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Notes ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm">Notes</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Internal notes</label>
            <textarea
              {...register("internalNotes")}
              rows={3}
              placeholder="Internal team notes…"
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className={labelCls}>Client-facing notes</label>
            <textarea
              {...register("clientNotes")}
              rows={3}
              placeholder="Notes visible to the client…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
      </div>

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createJob.isPending}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 text-sm transition-colors disabled:opacity-60"
        >
          {createJob.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {createJob.isPending ? "Creating job…" : "Create job"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

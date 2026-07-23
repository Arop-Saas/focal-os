"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import {
  Loader2, Plus, X, Search, Link2, Sparkles, Check,
  ChevronLeft, ChevronRight, User, Calendar,
  Building2, ListChecks, FileText, Clock,
} from "lucide-react";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isBefore, startOfDay, isSameDay, getDay,
} from "date-fns";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  clientId: z.string().min(1, "Select a client"),
  packageId: z.string().optional(),
  propertyAddress: z.string().min(5, "Enter the property address"),
  propertyUnit: z.string().optional(),
  propertyCity: z.string().min(1, "Enter the city"),
  propertyState: z.string().min(1, "Enter the state"),
  propertyZip: z.string().optional(),
  propertyType: z
    .enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "MULTI_FAMILY", "RENTAL", "NEW_CONSTRUCTION"])
    .default("RESIDENTIAL"),
  squareFootage: z.coerce.number().optional(),
  mlsNumber: z.string().optional(),
  listingUrl: z.string().optional(),
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "LAND", label: "Land" },
  { value: "MULTI_FAMILY", label: "Multi-Family" },
  { value: "RENTAL", label: "Rental" },
  { value: "NEW_CONSTRUCTION", label: "New Construction" },
];

const DURATION_OPTIONS = [
  { value: 30, label: "30m" },
  { value: 45, label: "45m" },
  { value: 60, label: "1h" },
  { value: 90, label: "1h 30m" },
  { value: 120, label: "2h" },
  { value: 150, label: "2h 30m" },
  { value: 180, label: "3h" },
  { value: 240, label: "4h" },
];

// 30-min time slots from 7:00 AM to 7:00 PM
const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 19; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 19) TIME_SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

function formatTimeSlot(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${mStr} ${ampm}`;
}

const STEPS = [
  { key: "client",   label: "Client",   icon: User },
  { key: "property", label: "Property", icon: Building2 },
  { key: "services", label: "Services", icon: ListChecks },
  { key: "schedule", label: "Schedule", icon: Calendar },
  { key: "notes",    label: "Notes",    icon: FileText },
];

const STEP_VALIDATE_FIELDS: (keyof FormData)[][] = [
  ["clientId"],
  ["propertyAddress", "propertyCity", "propertyState"],
  [],
  [],
  [],
];

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white";
const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  done
                    ? "bg-blue-600 text-white"
                    : active
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`text-[10px] font-medium hidden sm:block ${
                  active ? "text-blue-600" : done ? "text-gray-500" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 mb-4 transition-colors ${
                  done ? "bg-blue-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Searchable service picker ────────────────────────────────────────────────

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
                  onClick={() => {
                    onAdd(s);
                    setSearch("");
                    setOpen(false);
                  }}
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

// ─── Calendly-style calendar picker ──────────────────────────────────────────

function CalendarPicker({
  value,
  onChange,
}: {
  value: string; // "YYYY-MM-DDTHH:mm" or ""
  onChange: (v: string) => void;
}) {
  const today = startOfDay(new Date());
  const [month, setMonth] = useState<Date>(startOfMonth(today));

  const selectedDate = value ? startOfDay(new Date(value)) : null;
  const selectedTime = value?.includes("T") ? value.split("T")[1]?.slice(0, 5) ?? null : null;

  const days = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  }, [month]);

  const leadingBlanks = getDay(startOfMonth(month)); // 0 = Sunday

  function selectDay(day: Date) {
    const dateStr = format(day, "yyyy-MM-dd");
    const time = selectedTime ?? "09:00";
    onChange(`${dateStr}T${time}`);
  }

  function selectTime(time: string) {
    const dateStr = selectedDate
      ? format(selectedDate, "yyyy-MM-dd")
      : format(today, "yyyy-MM-dd");
    onChange(`${dateStr}T${time}`);
  }

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold text-gray-800 text-sm">{format(month, "MMMM yyyy")}</span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {/* Day-of-week headers */}
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 pb-2">
            {d}
          </div>
        ))}
        {/* Leading blanks */}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {/* Day cells */}
        {days.map((day) => {
          const isPast = isBefore(day, today);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className="flex justify-center py-0.5">
              <button
                type="button"
                disabled={isPast}
                onClick={() => selectDay(day)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-all flex items-center justify-center
                  ${isPast ? "text-gray-300 cursor-not-allowed" : ""}
                  ${isSelected ? "bg-blue-600 text-white shadow-sm scale-105" : ""}
                  ${!isSelected && !isPast && isToday ? "ring-2 ring-blue-400 ring-offset-1 text-blue-600" : ""}
                  ${!isSelected && !isPast && !isToday ? "hover:bg-blue-50 text-gray-700" : ""}
                `}
              >
                {format(day, "d")}
              </button>
            </div>
          );
        })}
      </div>

      {/* Time slots — shown once a day is selected */}
      {selectedDate && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            <Clock className="inline w-3 h-3 mr-1" />
            {format(selectedDate, "EEEE, MMMM d")}
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => selectTime(slot)}
                className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                  selectedTime === slot
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"
                }`}
              >
                {formatTimeSlot(slot)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function NewJobForm({ clients, packages, services, staff, defaultClientId }: NewJobFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [clientSearch, setClientSearch] = useState("");
  // Inline client creation — new clients appear in the picker immediately
  const [localClients, setLocalClients] = useState<Client[]>(clients);
  const [showNewClient, setShowNewClient] = useState(false);
  const [ncFirst, setNcFirst] = useState("");
  const [ncLast, setNcLast] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  // Structured property access — composed into accessNotes on submit
  const [accessType, setAccessType] = useState("");
  const [accessDetail, setAccessDetail] = useState("");
  const [clientSource, setClientSource] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [mlsSearchValue, setMlsSearchValue] = useState("");
  const [mlsAttached, setMlsAttached] = useState(false);

  const createJob = trpc.jobs.create.useMutation({
    onSuccess: (job) => router.push(`/jobs/${job.id}`),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
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

  const clientId = watch("clientId");
  const selectedPackageId = watch("packageId");
  const priority = watch("priority");
  const scheduledAt = watch("scheduledAt") ?? "";
  const pkg = packages.find((p) => p.id === selectedPackageId);

  // MLS auto-attach
  const { data: mlsSearchResult } = trpc.jobs.list.useQuery(
    { search: mlsSearchValue, limit: 5, sortBy: "scheduledAt", sortDir: "desc" },
    { enabled: mlsSearchValue.length >= 3 }
  );
  const mlsSuggestion =
    mlsSearchResult?.jobs.find(
      (j) => j.mlsNumber?.toLowerCase() === mlsSearchValue.toLowerCase()
    ) ?? null;

  function applyListingSuggestion(job: NonNullable<typeof mlsSuggestion>) {
    setValue("propertyAddress", job.propertyAddress, { shouldValidate: true });
    setValue("propertyCity", job.propertyCity, { shouldValidate: true });
    setValue("propertyState", job.propertyState, { shouldValidate: true });
    if (job.propertyZip) setValue("propertyZip", job.propertyZip);
    if (job.squareFootage) setValue("squareFootage", job.squareFootage);
    setValue("propertyType", job.propertyType as FormData["propertyType"]);
    setMlsAttached(true);
  }

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
    setSelectedStaff((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function goNext() {
    const fields = STEP_VALIDATE_FIELDS[step];
    const valid = fields.length === 0 ? true : await trigger(fields);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(data: FormData) {
    const ACCESS_LABELS: Record<string, string> = {
      REALTOR: "Realtor will meet you",
      SELLER: "Sellers will meet you",
      LOCKBOX: "Lockbox",
      VACANT: "Vacant — go & shoot",
      OTHER: "Other",
    };
    const accessNotes = accessType
      ? [ACCESS_LABELS[accessType], accessDetail.trim()].filter(Boolean).join(" — ")
      : undefined;
    await createJob.mutateAsync({
      ...data,
      accessNotes,
      clientSource: clientSource || undefined,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      services: selectedServices.map((s) => ({
        serviceId: s.serviceId,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
      })),
      assignedStaffIds: selectedStaff,
    });
  }

  const createClientMutation = trpc.clients.create.useMutation();
  const ncValid = ncFirst.trim() && ncLast.trim() && /^\S+@\S+\.\S+$/.test(ncEmail.trim());

  async function handleCreateClient() {
    if (!ncValid) return;
    const created = await createClientMutation.mutateAsync({
      firstName: ncFirst.trim(),
      lastName: ncLast.trim(),
      email: ncEmail.trim(),
      phone: ncPhone.trim() || undefined,
    });
    const asClient: Client = {
      id: created.id,
      firstName: created.firstName,
      lastName: created.lastName,
      email: created.email,
      company: created.company ?? null,
    };
    setLocalClients((prev) => [asClient, ...prev]);
    setValue("clientId", asClient.id, { shouldValidate: true });
    setShowNewClient(false);
    setClientSearch("");
    setNcFirst(""); setNcLast(""); setNcEmail(""); setNcPhone("");
  }

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase();
    if (!q) return localClients;
    return localClients.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q)
    );
  }, [localClients, clientSearch]);

  const selectedClient = localClients.find((c) => c.id === clientId);
  const servicesTotal = selectedServices.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto">
      <StepIndicator current={step} />

      {createJob.error && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {createJob.error.message}
        </div>
      )}

      {/* ── Step 0: Client ─────────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">Select a client</h3>
            <p className="text-sm text-gray-500 mt-0.5">Who is this shoot for?</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Search by name, email or company…"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {showNewClient ? (
            <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
              <p className="text-sm font-semibold text-gray-900">New client</p>
              <div className="grid grid-cols-2 gap-2">
                <input value={ncFirst} onChange={(e) => setNcFirst(e.target.value)} placeholder="First name"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={ncLast} onChange={(e) => setNcLast(e.target.value)} placeholder="Last name"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <input value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} type="email" placeholder="Email"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} type="tel" placeholder="Phone (optional)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {createClientMutation.error && (
                <p className="text-xs text-red-600">{createClientMutation.error.message}</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowNewClient(false)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={handleCreateClient} disabled={!ncValid || createClientMutation.isPending}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {createClientMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create & select
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowNewClient(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600">
              <Plus className="h-4 w-4" /> Create new client
            </button>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto -mx-1 px-1">
            {filteredClients.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No clients found.</p>
            ) : (
              filteredClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setValue("clientId", c.id, { shouldValidate: true });
                    setClientSearch("");
                  }}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    clientId === c.id
                      ? "border-blue-400 bg-blue-50 shadow-sm"
                      : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                    {c.firstName.charAt(0)}{c.lastName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {c.company ? `${c.company} · ` : ""}{c.email}
                    </p>
                  </div>
                  {clientId === c.id && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              ))
            )}
          </div>

          {errors.clientId && (
            <p className="text-xs text-red-600">{errors.clientId.message}</p>
          )}

          {/* Priority (here so it doesn't crowd the schedule step) */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
            <div>
              <label className={labelCls}>Priority</label>
              <select {...register("priority")} className={inputCls}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            {(priority === "HIGH" || priority === "URGENT") && (
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
      )}

      {/* ── Step 1: Property ───────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">Property details</h3>
            <p className="text-sm text-gray-500 mt-0.5">Where is the shoot taking place?</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>
                Street address <span className="text-red-500">*</span>
              </label>
              <AddressAutocomplete
                value={watch("propertyAddress") ?? ""}
                onChange={(v) => setValue("propertyAddress", v, { shouldValidate: true })}
                onSelect={(result) => {
                  if (result.streetAddress)
                    setValue("propertyAddress", result.streetAddress, { shouldValidate: true });
                  if (result.city)
                    setValue("propertyCity", result.city, { shouldValidate: true });
                  if (result.state)
                    setValue("propertyState", result.state, { shouldValidate: true });
                  if (result.zip) setValue("propertyZip", result.zip);
                }}
                placeholder="123 Oak Street"
              />
              {errors.propertyAddress && (
                <p className="mt-1 text-xs text-red-600">{errors.propertyAddress.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Unit / Suite</label>
              <input {...register("propertyUnit")} placeholder="Apt 4B" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>
                City <span className="text-red-500">*</span>
              </label>
              <input
                {...register("propertyCity")}
                placeholder="Nashville"
                className={inputCls}
              />
              {errors.propertyCity && (
                <p className="mt-1 text-xs text-red-600">{errors.propertyCity.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>
                State <span className="text-red-500">*</span>
              </label>
              <input {...register("propertyState")} placeholder="TN" className={inputCls} />
              {errors.propertyState && (
                <p className="mt-1 text-xs text-red-600">{errors.propertyState.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Zip</label>
              <input {...register("propertyZip")} placeholder="37201" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Property type</label>
              <select {...register("propertyType")} className={inputCls}>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Square footage</label>
              <input
                {...register("squareFootage")}
                type="number"
                placeholder="2,400"
                className={inputCls}
              />
            </div>
          </div>

          {/* Property access */}
          <div>
            <label className={labelCls}>Access</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Property access">
              {[
                { value: "REALTOR", label: "Realtor will meet you" },
                { value: "SELLER", label: "Sellers will meet you" },
                { value: "LOCKBOX", label: "Lockbox" },
                { value: "VACANT", label: "Vacant — go & shoot" },
                { value: "OTHER", label: "Other" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={accessType === opt.value}
                  onClick={() => setAccessType(accessType === opt.value ? "" : opt.value)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                    accessType === opt.value
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {(accessType === "LOCKBOX" || accessType === "OTHER") && (
              <input
                value={accessDetail}
                onChange={(e) => setAccessDetail(e.target.value)}
                placeholder={accessType === "LOCKBOX" ? "Lockbox code & location" : "Describe how the photographer gets in"}
                className={`${inputCls} mt-2`}
              />
            )}
          </div>

          {/* How did you hear about us */}
          <div>
            <label className={labelCls}>How did you hear about us? <span className="font-normal text-gray-400">(optional)</span></label>
            <select value={clientSource} onChange={(e) => setClientSource(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {["Google", "Referral", "Instagram", "Facebook", "Zillow", "Repeat client", "Other"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">Saved on the client&apos;s profile the first time it&apos;s answered.</p>
          </div>
        </div>
      )}

      {/* ── Step 2: Services ───────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">Services</h3>
            <p className="text-sm text-gray-500 mt-0.5">What will be delivered for this shoot?</p>
          </div>

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

          {!pkg && (
            <div className="space-y-2">
              {selectedServices.length > 0 && (
                <div className="space-y-2">
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
                  <div className="flex justify-end pt-2 border-t text-sm font-semibold text-gray-800">
                    Total: {formatCurrency(servicesTotal)}
                  </div>
                </div>
              )}
              {selectedServices.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                  No services added yet — click below to add some.
                </p>
              )}
              <ServicePicker services={services} selected={selectedServices} onAdd={addService} />
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Schedule ───────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-6">
            <div className="mb-5">
              <h3 className="font-semibold text-gray-900">Schedule the shoot</h3>
              <p className="text-sm text-gray-500 mt-0.5">Pick a date and time.</p>
            </div>

            <CalendarPicker
              value={scheduledAt}
              onChange={(v) => setValue("scheduledAt", v)}
            />

            <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-gray-100">
              <div>
                <label className={labelCls}>
                  <Clock className="inline w-3.5 h-3.5 mr-1 text-gray-400" />
                  Duration
                </label>
                <select {...register("estimatedDurationMins")} className={inputCls}>
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="self-end pb-1">
                {scheduledAt ? (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-800">
                      {new Date(scheduledAt).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">No time selected yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Photographer assignment */}
          {staff.length > 0 && (
            <div className="bg-white rounded-xl border p-6 space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Assign photographer</h3>
                <p className="text-xs text-gray-400 mt-0.5">Optional — can be assigned later.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {staff.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStaff(s.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      selectedStaff.includes(s.id)
                        ? "bg-blue-50 border-blue-400 text-blue-700"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xs font-bold shrink-0">
                      {s.member.user.fullName.charAt(0)}
                    </div>
                    <span className="truncate flex-1">{s.member.user.fullName}</span>
                    {selectedStaff.includes(s.id) && (
                      <Check className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Notes + Review ─────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">Notes</h3>
              <p className="text-sm text-gray-500 mt-0.5">Any final details before creating the job.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Notes <span className="font-normal text-gray-400">(optional)</span></label>
                <textarea
                  {...register("internalNotes")}
                  rows={4}
                  placeholder="Any specific requests or info the photographer should know?"
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div>
                <label className={labelCls}>Client-facing notes</label>
                <textarea
                  {...register("clientNotes")}
                  rows={4}
                  placeholder="Notes visible to the client…"
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          </div>

          {/* Summary card */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Summary</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {selectedClient && (
                <div>
                  <p className="text-xs text-gray-400">Client</p>
                  <p className="font-medium text-gray-800">
                    {selectedClient.firstName} {selectedClient.lastName}
                  </p>
                </div>
              )}
              {watch("propertyAddress") && (
                <div>
                  <p className="text-xs text-gray-400">Property</p>
                  <p className="font-medium text-gray-800 truncate">
                    {watch("propertyAddress")}, {watch("propertyCity")}
                  </p>
                </div>
              )}
              {scheduledAt && (
                <div>
                  <p className="text-xs text-gray-400">Scheduled</p>
                  <p className="font-medium text-gray-800">
                    {new Date(scheduledAt).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
              {(pkg || selectedServices.length > 0) && (
                <div>
                  <p className="text-xs text-gray-400">Services</p>
                  <p className="font-medium text-gray-800">
                    {pkg
                      ? `${pkg.name} (${formatCurrency(pkg.price)})`
                      : `${selectedServices.length} service${selectedServices.length !== 1 ? "s" : ""} — ${formatCurrency(servicesTotal)}`}
                  </p>
                </div>
              )}
              {selectedStaff.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400">Assigned to</p>
                  <p className="font-medium text-gray-800">
                    {selectedStaff
                      .map((id) => staff.find((s) => s.id === id)?.member.user.fullName)
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400">Priority</p>
                <p className="font-medium text-gray-800 capitalize">{priority.toLowerCase()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mt-6">
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={createJob.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 text-sm transition-colors disabled:opacity-60"
          >
            {createJob.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {createJob.isPending ? "Creating…" : "Create job"}
          </button>
        )}

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

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Loader2, Search, ChevronDown, BookOpen, Percent, DollarSign } from "lucide-react";

const lineItemSchema = z.object({
  description: z.string().min(1, "Required"),
  quantity: z.coerce.number().min(1, "Min 1"),
  unitPrice: z.coerce.number().min(0, "Must be ≥ 0"),
});

const formSchema = z.object({
  clientId: z.string().min(1, "Select a client"),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discountAmount: z.coerce.number().min(0).default(0),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type Client = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string | null;
};

type Service = {
  id: string;
  name: string;
  basePrice: number;
  category: string;
};

interface NewInvoiceFormProps {
  clients: Client[];
  services?: Service[];
  prefillClientId?: string;
  prefillJobId?: string;
  prefillLineItems?: { description: string; quantity: number; unitPrice: number }[];
  defaultDueDate?: string;
  defaultTaxRate?: number;
}

// Searchable client picker component
function ClientPicker({
  clients,
  value,
  onChange,
  error,
}: {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find((c) => c.id === value);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company?.toLowerCase().includes(q) ?? false)
    );
  });

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? "border-red-300" : "border-gray-200"
        } bg-white`}
      >
        {selectedClient ? (
          <span className="text-gray-900">
            {selectedClient.firstName} {selectedClient.lastName}
            {selectedClient.company ? ` — ${selectedClient.company}` : ""}
          </span>
        ) : (
          <span className="text-gray-400">Select a client…</span>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="flex-1 text-sm outline-none placeholder:text-gray-400"
            />
          </div>

          {/* Results */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No clients found</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between gap-2 ${
                    c.id === value ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                  }`}
                >
                  <span>
                    {c.firstName} {c.lastName}
                    {c.company && (
                      <span className="text-gray-400 font-normal"> — {c.company}</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{c.email}</span>
                </button>
              ))
            )}
          </div>

          {/* Add new client shortcut */}
          <div className="border-t border-gray-100">
            <a
              href="/clients/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add new client
            </a>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// Service picker dropdown
function ServicePicker({
  services,
  onAdd,
}: {
  services: Service[];
  onAdd: (s: Service) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!services.length) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-medium"
      >
        <BookOpen className="w-3.5 h-3.5" /> Add from catalog
      </button>

      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
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
              <p className="text-xs text-gray-400 text-center py-4">No services found</p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onAdd(s);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                >
                  <span className="text-gray-700">{s.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatCurrency(s.basePrice)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Quick-pick discount presets
const DISCOUNT_PRESETS = [
  { label: "5% off",  type: "pct" as const, value: 5 },
  { label: "10% off", type: "pct" as const, value: 10 },
  { label: "15% off", type: "pct" as const, value: 15 },
  { label: "20% off", type: "pct" as const, value: 20 },
  { label: "$25 off",  type: "fixed" as const, value: 25 },
  { label: "$50 off",  type: "fixed" as const, value: 50 },
  { label: "$100 off", type: "fixed" as const, value: 100 },
];

export function NewInvoiceForm({
  clients,
  services = [],
  prefillClientId,
  prefillJobId,
  prefillLineItems = [],
  defaultDueDate,
  defaultTaxRate = 0,
}: NewInvoiceFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [discountMode, setDiscountMode] = useState<"fixed" | "pct">("fixed");
  const [discountInput, setDiscountInput] = useState("0");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: prefillClientId ?? "",
      lineItems:
        prefillLineItems.length > 0
          ? prefillLineItems
          : [{ description: "", quantity: 1, unitPrice: 0 }],
      taxRate: defaultTaxRate,
      discountAmount: 0,
      dueAt: defaultDueDate ?? "",
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });

  const createInvoice = api.invoices.create.useMutation({
    onSuccess: (invoice) => {
      router.push(`/invoices/${invoice.id}`);
    },
    onError: (err) => {
      setServerError(err.message || "Failed to create invoice.");
    },
  });

  // Live totals
  const watchedItems = watch("lineItems");
  const watchedTax = watch("taxRate") ?? 0;
  const clientId = watch("clientId");

  const subtotal = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );

  // Compute discount $ amount from either fixed or percentage input
  const discountRaw = parseFloat(discountInput) || 0;
  const computedDiscountAmount = discountMode === "pct"
    ? parseFloat(((subtotal * discountRaw) / 100).toFixed(2))
    : discountRaw;

  // Keep form value in sync
  useEffect(() => {
    setValue("discountAmount", computedDiscountAmount);
  }, [computedDiscountAmount, setValue]);

  const taxAmount = (subtotal * Number(watchedTax)) / 100;
  const total = subtotal + taxAmount - computedDiscountAmount;

  const onSubmit = useCallback(
    (values: FormValues) => {
      setServerError("");
      createInvoice.mutate({
        clientId: values.clientId,
        jobId: prefillJobId,
        lineItems: values.lineItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
        taxRate: Number(values.taxRate),
        discountAmount: Number(values.discountAmount),
        dueAt: values.dueAt ? new Date(values.dueAt) : undefined,
        notes: values.notes || undefined,
      });
    },
    [createInvoice, prefillJobId]
  );

  function addServiceAsLineItem(service: Service) {
    append({ description: service.name, quantity: 1, unitPrice: service.basePrice });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-5">

      {/* Client */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Client</h2>
        <ClientPicker
          clients={clients}
          value={clientId}
          onChange={(id) => setValue("clientId", id, { shouldValidate: true })}
          error={errors.clientId?.message}
        />
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Line Items</h2>

        <div className="space-y-2">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide px-1">
            <span className="col-span-6">Description</span>
            <span className="col-span-2 text-right">Qty</span>
            <span className="col-span-2 text-right">Unit Price</span>
            <span className="col-span-1 text-right">Total</span>
            <span className="col-span-1" />
          </div>

          {fields.map((field, i) => {
            const qty = Number(watchedItems[i]?.quantity) || 0;
            const price = Number(watchedItems[i]?.unitPrice) || 0;
            return (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-6">
                  <input
                    {...register(`lineItems.${i}.description`)}
                    placeholder="Description"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.lineItems?.[i]?.description && (
                    <p className="text-[10px] text-red-500 mt-0.5">
                      {errors.lineItems[i]?.description?.message}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <input
                    {...register(`lineItems.${i}.quantity`)}
                    type="number"
                    min="1"
                    step="1"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    {...register(`lineItems.${i}.unitPrice`)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-1 flex items-center justify-end pt-2">
                  <span className="text-sm font-medium text-gray-700">
                    {formatCurrency(qty * price)}
                  </span>
                </div>
                <div className="col-span-1 flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={fields.length === 1}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add line item
          </button>
          <ServicePicker services={services} onAdd={addServiceAsLineItem} />
        </div>

        {errors.lineItems && typeof errors.lineItems.message === "string" && (
          <p className="text-xs text-red-500">{errors.lineItems.message}</p>
        )}
      </div>

      {/* Totals + Extras */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Left: tax, discount, due date, notes */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Details</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tax Rate (%)</label>
              <div className="relative">
                <input
                  {...register("taxRate")}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {defaultTaxRate > 0 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-medium text-blue-500 bg-blue-50 px-1 rounded">
                    auto
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Discount</label>
              {/* Toggle: fixed vs % */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDiscountMode("fixed")}
                  className={`flex items-center gap-1 px-2 py-2 text-xs font-medium transition-colors ${discountMode === "fixed" ? "bg-gray-100 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}
                >
                  <DollarSign className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountMode("pct")}
                  className={`flex items-center gap-1 px-2 py-2 text-xs font-medium transition-colors border-l border-gray-200 ${discountMode === "pct" ? "bg-gray-100 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}
                >
                  <Percent className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min="0"
                  step={discountMode === "pct" ? "1" : "0.01"}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0"
                  className="flex-1 border-l border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                />
              </div>
              {/* Quick-pick presets */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {DISCOUNT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => { setDiscountMode(preset.type); setDiscountInput(String(preset.value)); }}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {computedDiscountAmount > 0 && discountMode === "pct" && (
                <p className="text-[10px] text-gray-400 mt-1">= {formatCurrency(computedDiscountAmount)} off</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
            <input
              {...register("dueAt")}
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
            <textarea
              {...register("notes")}
              rows={3}
              placeholder="Payment instructions, terms, etc."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Right: live totals + submit */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Summary</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            {Number(watchedTax) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax ({watchedTax}%)</span>
                <span className="font-medium text-gray-900">{formatCurrency(taxAmount)}</span>
              </div>
            )}
            {computedDiscountAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Discount{discountMode === "pct" ? ` (${discountInput}%)` : ""}</span>
                <span className="font-medium text-red-600">−{formatCurrency(computedDiscountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 mt-1">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-lg text-gray-900">{formatCurrency(Math.max(0, total))}</span>
            </div>
          </div>

          {serverError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={createInvoice.isPending}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60 mt-2"
          >
            {createInvoice.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Invoice
          </button>
          <p className="text-xs text-gray-400 text-center">Saved as draft — send when ready</p>
        </div>
      </div>
    </form>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Loader2 } from "lucide-react";

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

interface NewInvoiceFormProps {
  clients: Client[];
  prefillClientId?: string;
  prefillJobId?: string;
  prefillLineItems?: { description: string; quantity: number; unitPrice: number }[];
}

export function NewInvoiceForm({
  clients,
  prefillClientId,
  prefillJobId,
  prefillLineItems = [],
}: NewInvoiceFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: prefillClientId ?? "",
      lineItems:
        prefillLineItems.length > 0
          ? prefillLineItems
          : [{ description: "", quantity: 1, unitPrice: 0 }],
      taxRate: 0,
      discountAmount: 0,
      dueAt: "",
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
  const watchedDiscount = watch("discountAmount") ?? 0;

  const subtotal = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );
  const taxAmount = (subtotal * Number(watchedTax)) / 100;
  const total = subtotal + taxAmount - Number(watchedDiscount);

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-5">

      {/* Client */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Client</h2>
        <div>
          <select
            {...register("clientId")}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
                {c.company ? ` — ${c.company}` : ""}
                {" "}({c.email})
              </option>
            ))}
          </select>
          {errors.clientId && (
            <p className="text-xs text-red-500 mt-1">{errors.clientId.message}</p>
          )}
        </div>
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

        <button
          type="button"
          onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add line item
        </button>

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
              <input
                {...register("taxRate")}
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Discount ($)</label>
              <input
                {...register("discountAmount")}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
            {Number(watchedDiscount) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Discount</span>
                <span className="font-medium text-red-600">−{formatCurrency(Number(watchedDiscount))}</span>
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

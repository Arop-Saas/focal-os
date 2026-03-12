"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { Loader2, ChevronDown } from "lucide-react";

const schema = z.object({
  clientId: z.string().min(1, "Select a client"),
  packageId: z.string().optional(),
  propertyAddress: z.string().min(5, "Enter the property address"),
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
  isRush: z.boolean().default(false),
  rushFee: z.coerce.number().default(0),
  assignedStaffIds: z.array(z.string()).default([]),
});
type FormData = z.infer<typeof schema>;

type Client = { id: string; firstName: string; lastName: string; email: string; company: string | null };
type Package = { id: string; name: string; price: number; items: { service: { name: string } }[] };
type Service = { id: string; name: string; category: string; basePrice: number };
type Staff = { id: string; member: { user: { fullName: string } } };

interface NewJobFormProps {
  clients: Client[];
  packages: Package[];
  services: Service[];
  staff: Staff[];
}

export function NewJobForm({ clients, packages, services, staff }: NewJobFormProps) {
  const router = useRouter();
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);

  const createJob = trpc.jobs.create.useMutation({
    onSuccess: (job) => {
      router.push(`/jobs/${job.id}`);
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const selectedPackage = watch("packageId");
  const pkg = packages.find((p) => p.id === selectedPackage);

  async function onSubmit(data: FormData) {
    const services_: { serviceId: string; quantity: number; unitPrice: number }[] = [];
    if (pkg) {
      // Package handles pricing
    }

    await createJob.mutateAsync({
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      services: services_,
      assignedStaffIds: selectedStaff,
    });
  }

  function toggleStaff(id: string) {
    setSelectedStaff((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      {createJob.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {createJob.error.message}
        </div>
      )}

      {/* Client & Package */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Job details</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              {...register("clientId")}
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}{c.company ? ` — ${c.company}` : ""}
                </option>
              ))}
            </select>
            {errors.clientId && <p className="mt-1 text-xs text-red-600">{errors.clientId.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Package</label>
            <select
              {...register("packageId")}
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a package…</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatCurrency(p.price)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {pkg && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
            <strong>{pkg.name}</strong> includes:{" "}
            {pkg.items.map((i) => i.service.name).join(", ")}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Scheduled date & time
            </label>
            <input
              {...register("scheduledAt")}
              type="datetime-local"
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Est. duration (minutes)
            </label>
            <input
              {...register("estimatedDurationMins")}
              type="number"
              min={15}
              step={15}
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
            <select
              {...register("priority")}
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2 pb-2.5">
              <input {...register("isRush")} type="checkbox" id="isRush" className="h-4 w-4 rounded" />
              <label htmlFor="isRush" className="text-sm font-medium text-gray-700">Rush job</label>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rush fee</label>
              <input
                {...register("rushFee")}
                type="number"
                min={0}
                step={10}
                placeholder="0"
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Property info */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Property</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Street address <span className="text-red-500">*</span>
          </label>
          <input
            {...register("propertyAddress")}
            placeholder="123 Oak Street"
            className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.propertyAddress && <p className="mt-1 text-xs text-red-600">{errors.propertyAddress.message}</p>}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              City <span className="text-red-500">*</span>
            </label>
            <input
              {...register("propertyCity")}
              placeholder="Nashville"
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">State <span className="text-red-500">*</span></label>
            <input
              {...register("propertyState")}
              placeholder="TN"
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
            <select
              {...register("propertyType")}
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="LAND">Land</option>
              <option value="MULTI_FAMILY">Multi-family</option>
              <option value="RENTAL">Rental</option>
              <option value="NEW_CONSTRUCTION">New Construction</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sq ft</label>
            <input {...register("squareFootage")} type="number" placeholder="2,400" className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Beds</label>
            <input {...register("bedrooms")} type="number" placeholder="3" className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Baths</label>
            <input {...register("bathrooms")} type="number" step="0.5" placeholder="2.5" className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">MLS number</label>
            <input {...register("mlsNumber")} placeholder="MLS-12345" className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Zip code</label>
            <input {...register("propertyZip")} placeholder="37201" className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Access notes</label>
          <textarea
            {...register("accessNotes")}
            rows={2}
            placeholder="Lockbox code, gate code, parking instructions…"
            className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      {/* Assign photographer */}
      {staff.length > 0 && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Assign photographer</h3>
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

      {/* Notes */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Notes</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Internal notes</label>
            <textarea
              {...register("internalNotes")}
              rows={3}
              placeholder="Internal team notes…"
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Client-facing notes</label>
            <textarea
              {...register("clientNotes")}
              rows={3}
              placeholder="Notes visible to the client…"
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
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

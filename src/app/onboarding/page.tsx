"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import { Aperture, Loader2, Building2, Clock, Globe, ChevronRight, Check } from "lucide-react";
import { slugify } from "@/lib/utils";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Australia/Sydney",
  "Europe/London",
];

const step1Schema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  timezone: z.string(),
  city: z.string().optional(),
  state: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;

const STEPS = [
  { label: "Company info", description: "Name and contact details" },
  { label: "Services", description: "What you offer" },
  { label: "Team", description: "Invite your first team member" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [autoSlug, setAutoSlug] = useState(true);

  const createWorkspace = trpc.workspace.create.useMutation({
    onSuccess: () => {
      router.push("/");
      router.refresh();
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { timezone: "America/New_York" },
  });

  const watchName = watch("name");

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (autoSlug) {
      setValue("slug", slugify(val));
    }
  }

  async function onSubmit(data: Step1Data) {
    await createWorkspace.mutateAsync(data);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
            <Aperture className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-gray-900">Focal OS</span>
          <span className="text-gray-400 text-sm ml-2">Setup</span>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-6 pt-10">
        <div className="w-full max-w-lg">
          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    i < step
                      ? "bg-green-500 text-white"
                      : i === step
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <p className={`text-xs font-medium ${i === step ? "text-gray-900" : "text-gray-500"}`}>
                    {s.label}
                  </p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 ml-2 ${i < step ? "bg-green-400" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1 — Company Info */}
          {step === 0 && (
            <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border p-6 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Set up your workspace</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This is your company's home in Focal OS.
                </p>
              </div>

              {createWorkspace.error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {createWorkspace.error.message}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Company name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("name")}
                  onChange={(e) => {
                    register("name").onChange(e);
                    handleNameChange(e);
                  }}
                  placeholder="Blue Sky Real Estate Photography"
                  className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Workspace URL <span className="text-red-500">*</span>
                </label>
                <div className="flex rounded-lg border overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                  <span className="flex items-center px-3 bg-gray-50 border-r text-sm text-gray-500 shrink-0">
                    app.focal-os.com/
                  </span>
                  <input
                    {...register("slug")}
                    onFocus={() => setAutoSlug(false)}
                    placeholder="blue-sky-photo"
                    className="flex-1 px-3.5 py-2.5 text-sm focus:outline-none"
                  />
                </div>
                {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Work email</label>
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="hello@yourcompany.com"
                    className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input
                    {...register("phone")}
                    type="tel"
                    placeholder="(555) 000-0000"
                    className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                  <input
                    {...register("city")}
                    placeholder="Nashville"
                    className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
                  <input
                    {...register("state")}
                    placeholder="TN"
                    className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                <select
                  {...register("timezone")}
                  className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={createWorkspace.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-60 mt-2"
              >
                {createWorkspace.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {createWorkspace.isPending ? "Creating workspace…" : "Create workspace & continue"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

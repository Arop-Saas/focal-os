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
      <div className="bg-white border-b border-gray-100 px-6 h-14 flex items-center shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
            <Aperture className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-gray-900">Focal OS</span>
          <span className="text-gray-300 mx-1.5 text-xs">·</span>
          <span className="text-[13px] text-gray-400">Workspace setup</span>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-6 pt-12">
        <div className="w-full max-w-[480px]">
          {/* Progress steps */}
          <div className="flex items-center gap-0 mb-8">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                      i < step
                        ? "bg-emerald-500 text-white"
                        : i === step
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {i < step ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className={`text-[12px] font-medium hidden sm:block ${i === step ? "text-gray-800" : "text-gray-400"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-3 transition-colors ${i < step ? "bg-emerald-300" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1 — Company Info */}
          {step === 0 && (
            <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 space-y-5">
              <div className="pb-1">
                <h2 className="text-[18px] font-bold text-gray-900">Set up your workspace</h2>
                <p className="text-[13px] text-gray-500 mt-1">
                  This is your company's home in Focal OS.
                </p>
              </div>

              {createWorkspace.error && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[13px] text-red-600">
                  {createWorkspace.error.message}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-gray-700">
                  Company name <span className="text-red-400">*</span>
                </label>
                <input
                  {...register("name")}
                  onChange={(e) => {
                    register("name").onChange(e);
                    handleNameChange(e);
                  }}
                  placeholder="Blue Sky Real Estate Photography"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
                />
                {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-gray-700">
                  Workspace URL <span className="text-red-400">*</span>
                </label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-gray-50 focus-within:bg-white transition-colors">
                  <span className="flex items-center px-3 bg-gray-100 border-r border-gray-200 text-[12px] text-gray-500 shrink-0 font-mono">
                    focal-os.com/
                  </span>
                  <input
                    {...register("slug")}
                    onFocus={() => setAutoSlug(false)}
                    placeholder="blue-sky-photo"
                    className="flex-1 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none"
                  />
                </div>
                {errors.slug && <p className="text-[11px] text-red-500 mt-1">{errors.slug.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">Work email <span className="text-red-400">*</span></label>
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="hello@company.com"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
                  />
                  {errors.email && <p className="text-[11px] text-red-500">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">Phone</label>
                  <input
                    {...register("phone")}
                    type="tel"
                    placeholder="(555) 000-0000"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">City</label>
                  <input
                    {...register("city")}
                    placeholder="Nashville"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">State</label>
                  <input
                    {...register("state")}
                    placeholder="TN"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-gray-700">Timezone</label>
                <select
                  {...register("timezone")}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
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
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-60 shadow-sm mt-1"
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

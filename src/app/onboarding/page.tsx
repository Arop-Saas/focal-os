"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import { Camera, Loader2, ChevronRight, Check, ArrowRight } from "lucide-react";
import { slugify } from "@/lib/utils";

// ─── Schemas ─────────────────────────────────────────────────────────────────

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

const TIMEZONES = [
  // United States
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  // Canada
  "America/Toronto",
  "America/Winnipeg",
  "America/Regina",
  "America/Edmonton",
  "America/Vancouver",
  "America/Halifax",
  "America/St_Johns",
  // Other
  "Australia/Sydney",
  "Europe/London",
];

// ─── Service presets ──────────────────────────────────────────────────────────

type ServicePreset = {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultPrice: number;
  unit: string;
};

const SERVICE_PRESETS: ServicePreset[] = [
  { id: "photo",      name: "Real Estate Photography", description: "Interior & exterior photos",    icon: "📷", defaultPrice: 299, unit: "per shoot" },
  { id: "drone",      name: "Drone Photography",        description: "Aerial photos & video",         icon: "🚁", defaultPrice: 199, unit: "per shoot" },
  { id: "video",      name: "Video Tour",               description: "Walkthrough video production",  icon: "🎬", defaultPrice: 399, unit: "per shoot" },
  { id: "floorplan",  name: "Floor Plans",              description: "2D/3D floor plan drawings",     icon: "📐", defaultPrice: 149, unit: "per shoot" },
  { id: "virtual",    name: "Virtual Staging",          description: "Digital furniture staging",     icon: "🏠", defaultPrice:  99, unit: "per room"  },
  { id: "twilight",   name: "Twilight Photography",     description: "Golden hour / dusk shots",      icon: "🌅", defaultPrice: 349, unit: "per shoot" },
  { id: "matterport", name: "3D Virtual Tour",          description: "Matterport / 360° tour",        icon: "🔮", defaultPrice: 249, unit: "per shoot" },
  { id: "social",     name: "Social Media Content",     description: "Reels, stories & clips",        icon: "📱", defaultPrice: 149, unit: "per shoot" },
];

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Studio info",  icon: "🏢" },
  { label: "Services",     icon: "📋" },
  { label: "Invite team",  icon: "👥" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [autoSlug, setAutoSlug] = useState(true);

  // Step 2 state
  const [selectedServices, setSelectedServices] = useState<Record<string, { enabled: boolean; price: number }>>(() =>
    Object.fromEntries(SERVICE_PRESETS.map((s) => [s.id, { enabled: s.id === "photo", price: s.defaultPrice }]))
  );

  // Step 3 state
  const [inviteName, setInviteName]   = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState<"PHOTOGRAPHER" | "EDITOR" | "MANAGER">("PHOTOGRAPHER");
  const [inviteSent, setInviteSent]   = useState(false);

  // Mutations
  const createWorkspace    = trpc.workspace.create.useMutation({ onSuccess: () => setStep(1) });
  const createService      = trpc.packages.createService.useMutation();
  const inviteStaff        = trpc.staff.invite.useMutation();
  const completeOnboarding = trpc.workspace.completeOnboarding.useMutation({
    onSuccess: () => { router.push("/"); router.refresh(); },
  });

  // Form
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { timezone: "America/New_York" },
  });

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (autoSlug) setValue("slug", slugify(e.target.value));
  }

  // Handlers
  async function onStep1Submit(data: Step1Data) {
    await createWorkspace.mutateAsync(data);
  }

  async function onStep2Continue() {
    const enabled = SERVICE_PRESETS.filter((s) => selectedServices[s.id]?.enabled);
    await Promise.all(
      enabled.map((preset) =>
        createService.mutateAsync({
          name: preset.name,
          description: preset.description,
          defaultPrice: selectedServices[preset.id]?.price ?? preset.defaultPrice,
          duration: 90,
        }).catch(() => { /* ignore duplicates */ })
      )
    );
    setStep(2);
  }

  async function onStep3Continue(skip = false) {
    if (!skip && inviteEmail && inviteName) {
      try {
        await inviteStaff.mutateAsync({ email: inviteEmail, fullName: inviteName, role: inviteRole });
        setInviteSent(true);
      } catch { /* non-fatal */ }
    }
    await completeOnboarding.mutateAsync();
  }

  const isFinishing = completeOnboarding.isPending || inviteStaff.isPending;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 h-14 flex items-center shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
            <Camera className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[15px] font-bold text-gray-900">Scalist</span>
          <span className="text-gray-300 mx-1.5 text-xs">·</span>
          <span className="text-[13px] text-gray-400">Workspace setup</span>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-6 pt-12">
        <div className="w-full max-w-[520px]">

          {/* Progress steps */}
          <div className="flex items-center mb-8">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${
                    i < step ? "bg-emerald-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
                  }`}>
                    {i < step ? <Check className="h-3.5 w-3.5" /> : s.icon}
                  </div>
                  <span className={`text-[12px] font-medium hidden sm:block ${
                    i < step ? "text-emerald-600" : i === step ? "text-gray-800" : "text-gray-400"
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-3 ${i < step ? "bg-emerald-300" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>

          {/* ── STEP 0: Studio info ───────────────────────────────────────── */}
          {step === 0 && (
            <form onSubmit={handleSubmit(onStep1Submit)} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 space-y-5">
              <div>
                <h2 className="text-[18px] font-bold text-gray-900">Set up your studio</h2>
                <p className="text-[13px] text-gray-500 mt-1">This is your company&apos;s home in Scalist.</p>
              </div>

              {createWorkspace.error && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[13px] text-red-600">
                  {createWorkspace.error.message}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-gray-700">Company name <span className="text-red-400">*</span></label>
                <input
                  {...register("name")}
                  onChange={(e) => { register("name").onChange(e); handleNameChange(e); }}
                  placeholder="Blue Sky Real Estate Photography"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
                />
                {errors.name && <p className="text-[11px] text-red-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-gray-700">Workspace URL <span className="text-red-400">*</span></label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 bg-gray-50 focus-within:bg-white transition-colors">
                  <span className="flex items-center px-3 bg-gray-100 border-r border-gray-200 text-[12px] text-gray-500 shrink-0 font-mono">app/</span>
                  <input
                    {...register("slug")}
                    onFocus={() => setAutoSlug(false)}
                    placeholder="blue-sky-photo"
                    className="flex-1 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none"
                  />
                </div>
                {errors.slug && <p className="text-[11px] text-red-500">{errors.slug.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">Work email <span className="text-red-400">*</span></label>
                  <input {...register("email")} type="email" placeholder="hello@company.com"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors" />
                  {errors.email && <p className="text-[11px] text-red-500">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">Phone</label>
                  <input {...register("phone")} type="tel" placeholder="(555) 000-0000"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">City</label>
                  <input {...register("city")} placeholder="Nashville"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">State / Province</label>
                  <input {...register("state")} placeholder="TN / ON"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-gray-700">Timezone</label>
                <select {...register("timezone")}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors">
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
                </select>
              </div>

              <button type="submit" disabled={createWorkspace.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-60 shadow-sm">
                {createWorkspace.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                {createWorkspace.isPending ? "Creating workspace…" : "Continue →"}
              </button>
            </form>
          )}

          {/* ── STEP 1: Services ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 space-y-5">
              <div>
                <h2 className="text-[18px] font-bold text-gray-900">What services do you offer?</h2>
                <p className="text-[13px] text-gray-500 mt-1">Select all that apply and set your starting prices. You can edit these anytime.</p>
              </div>

              <div className="space-y-2">
                {SERVICE_PRESETS.map((preset) => {
                  const sel = selectedServices[preset.id];
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedServices((prev) => ({
                        ...prev,
                        [preset.id]: { ...prev[preset.id]!, enabled: !prev[preset.id]?.enabled },
                      }))}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all select-none ${
                        sel?.enabled ? "border-blue-200 bg-blue-50/50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        sel?.enabled ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"
                      }`}>
                        {sel?.enabled && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-xl shrink-0">{preset.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{preset.name}</p>
                        <p className="text-[11px] text-gray-500">{preset.description}</p>
                      </div>
                      {sel?.enabled && (
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            value={sel.price}
                            onChange={(e) => setSelectedServices((prev) => ({
                              ...prev,
                              [preset.id]: { ...prev[preset.id]!, price: Number(e.target.value) },
                            }))}
                            className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2.5 transition-colors">
                  Skip
                </button>
                <button onClick={onStep2Continue} disabled={createService.isPending}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-60 shadow-sm">
                  {createService.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                  {createService.isPending ? "Saving…" : "Save & continue →"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Invite team ──────────────────────────────────────── */}
          {step === 2 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 space-y-5">
              <div>
                <h2 className="text-[18px] font-bold text-gray-900">Invite your first team member</h2>
                <p className="text-[13px] text-gray-500 mt-1">
                  They&apos;ll get an email with a link to set up their account and access the photographer app.
                </p>
              </div>

              {inviteSent ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                  <p className="text-sm text-emerald-700 font-medium">Invite sent to {inviteEmail}!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-gray-700">Full name</label>
                    <input value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Jordan Smith"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-gray-700">Email address</label>
                    <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="jordan@yourcompany.com"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-gray-700">Role</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["PHOTOGRAPHER", "EDITOR", "MANAGER"] as const).map((r) => (
                        <button key={r} type="button" onClick={() => setInviteRole(r)}
                          className={`py-2.5 rounded-lg text-[12px] font-semibold border transition-all ${
                            inviteRole === r ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}>
                          {r === "PHOTOGRAPHER" ? "📷 Photographer" : r === "EDITOR" ? "🎨 Editor" : "👔 Manager"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {inviteStaff.error && (
                <p className="text-[12px] text-red-500">{inviteStaff.error.message}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => onStep3Continue(true)} disabled={isFinishing}
                  className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2.5 transition-colors disabled:opacity-40">
                  Skip for now
                </button>
                <button onClick={() => onStep3Continue(false)} disabled={isFinishing}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-60 shadow-sm">
                  {isFinishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {isFinishing ? "Setting up your dashboard…" : inviteEmail ? "Send invite & open dashboard →" : "Go to dashboard →"}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-[12px] text-blue-700">
                  🎉 <strong>Your 14-day free trial has started.</strong> No credit card needed until you&apos;re ready to upgrade.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

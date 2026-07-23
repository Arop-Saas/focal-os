"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Globe,
  Loader2,
  Plus,
  Sparkles,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { SingleCityAutocomplete, type SelectedCity } from "@/components/shared/single-city-autocomplete";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(10, "Enter a valid phone number"),
  timezone: z.string(),
});
type Step1Data = z.infer<typeof step1Schema>;

// ─── Constants ───────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
];

const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York",    label: "Eastern Time — New York" },
  { value: "America/Chicago",     label: "Central Time — Chicago" },
  { value: "America/Denver",      label: "Mountain Time — Denver" },
  { value: "America/Los_Angeles", label: "Pacific Time — Los Angeles" },
  { value: "America/Phoenix",     label: "Arizona — Phoenix" },
  { value: "America/Anchorage",   label: "Alaska — Anchorage" },
  { value: "Pacific/Honolulu",    label: "Hawaii — Honolulu" },
  { value: "America/Toronto",     label: "Eastern Time — Toronto" },
  { value: "America/Winnipeg",    label: "Central Time — Winnipeg" },
  { value: "America/Regina",      label: "Saskatchewan — Regina" },
  { value: "America/Edmonton",    label: "Mountain Time — Edmonton" },
  { value: "America/Vancouver",   label: "Pacific Time — Vancouver" },
  { value: "America/Halifax",     label: "Atlantic Time — Halifax" },
  { value: "America/St_Johns",    label: "Newfoundland — St. John's" },
  { value: "Europe/London",       label: "United Kingdom — London" },
  { value: "Australia/Sydney",    label: "Australia — Sydney" },
];

const VOLUME_OPTIONS = [
  { value: "1-10",   label: "1–10 shoots",   caption: "Just getting started" },
  { value: "11-30",  label: "11–30 shoots",  caption: "Steady part-time volume" },
  { value: "31-75",  label: "31–75 shoots",  caption: "Full-time studio" },
  { value: "76-150", label: "76–150 shoots", caption: "Established team" },
  { value: "150+",   label: "150+ shoots",   caption: "High-volume operation" },
];

// Displayed as Owner / Admin / Member; "Member" maps to the standard staff role
const INVITE_ROLES = [
  { label: "Owner",  value: "OWNER" },
  { label: "Admin",  value: "ADMIN" },
  { label: "Member", value: "PHOTOGRAPHER" },
] as const;
type InviteRoleValue = (typeof INVITE_ROLES)[number]["value"];

type TeammateRow = { fullName: string; email: string; role: InviteRoleValue };
const EMPTY_ROW: TeammateRow = { fullName: "", email: "", role: "PHOTOGRAPHER" };

const STEPS = [
  { label: "Studio info",    icon: Building2 },
  { label: "Monthly volume", icon: BarChart3 },
  { label: "Invite team",    icon: Users },
];

/** "Blue Sky Photo Co." → "blueskyphotoco" — the workspace subdomain */
function toSubdomain(name: string) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "").slice(0, 50);
}

const inputClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-sm placeholder:text-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1 state
  const [country, setCountry] = useState("US");
  const [selectedCity, setSelectedCity] = useState<SelectedCity | null>(null);
  const [cityError, setCityError] = useState(false);

  // Step 2 state
  const [volume, setVolume] = useState<string | null>(null);

  // Step 3 state
  const [teammates, setTeammates] = useState<TeammateRow[]>([{ ...EMPTY_ROW }]);

  // Mutations
  const createWorkspace    = trpc.workspace.create.useMutation({ onSuccess: () => setStep(1) });
  const updateWorkspace    = trpc.workspace.update.useMutation();
  const inviteStaff        = trpc.staff.invite.useMutation();
  const completeOnboarding = trpc.workspace.completeOnboarding.useMutation({
    onSuccess: () => { router.push("/"); router.refresh(); },
  });

  // Form
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { timezone: "America/New_York" },
  });

  // Workspace address derived from company name, with live availability check
  const companyName = watch("name") ?? "";
  const slug = useMemo(() => toSubdomain(companyName), [companyName]);
  const [debouncedSlug, setDebouncedSlug] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSlug(slug), 400);
    return () => clearTimeout(t);
  }, [slug]);
  const slugCheck = trpc.workspace.slugAvailable.useQuery(
    { slug: debouncedSlug },
    { enabled: debouncedSlug.length >= 2, staleTime: 10_000 }
  );
  const slugPending = slug.length >= 2 && (slug !== debouncedSlug || slugCheck.isLoading);

  // Handlers
  async function onStep1Submit(data: Step1Data) {
    if (!selectedCity) {
      setCityError(true);
      return;
    }
    await createWorkspace.mutateAsync({
      name: data.name,
      slug,
      email: data.email,
      phone: data.phone,
      timezone: data.timezone,
      country,
      city: selectedCity.city,
      state: selectedCity.state,
    });
  }

  async function onStep2Continue(skip = false) {
    if (!skip && volume) {
      try {
        await updateWorkspace.mutateAsync({ estimatedShootsPerMonth: volume });
      } catch { /* non-fatal */ }
    }
    setStep(2);
  }

  function setTeammate(index: number, patch: Partial<TeammateRow>) {
    setTeammates((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function onFinish(skip = false) {
    if (!skip) {
      const valid = teammates.filter(
        (t) => t.fullName.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(t.email.trim())
      );
      await Promise.allSettled(
        valid.map((t) =>
          inviteStaff.mutateAsync({ fullName: t.fullName.trim(), email: t.email.trim(), role: t.role })
        )
      );
    }
    await completeOnboarding.mutateAsync();
  }

  const isFinishing = completeOnboarding.isPending || inviteStaff.isPending;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center border-b border-gray-100 bg-white px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
            <Camera className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[15px] font-bold text-gray-900">Scalist</span>
          <span className="mx-1.5 text-xs text-gray-300">·</span>
          <span className="text-[13px] text-gray-400">Workspace setup</span>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center p-6 pt-12">
        <div className="w-full max-w-[560px]">

          {/* Progress steps */}
          <div className="mb-8 flex items-center">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <div key={s.label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex shrink-0 items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all ${
                        done
                          ? "border-blue-600 bg-blue-600 text-white"
                          : active
                            ? "border-blue-600 bg-white text-blue-600 shadow-sm"
                            : "border-gray-200 bg-white text-gray-300"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span
                      className={`hidden text-[13px] font-medium sm:block ${
                        done || active ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`mx-4 h-px flex-1 ${done ? "bg-blue-600" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── STEP 0: Studio info ───────────────────────────────────────── */}
          {step === 0 && (
            <form
              onSubmit={handleSubmit(onStep1Submit)}
              className="space-y-5 rounded-2xl border border-gray-200/70 bg-white p-8 shadow-sm"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Set up your studio</h2>
                <p className="mt-1 text-[13px] text-gray-500">This is your company&apos;s home in Scalist.</p>
              </div>

              {createWorkspace.error && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                  {createWorkspace.error.message}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-gray-700">
                  Company name <span className="text-red-400">*</span>
                </label>
                <input {...register("name")} placeholder="Blue Sky Real Estate Photography" className={inputClass} />
                {errors.name && <p className="text-[11px] text-red-500">{errors.name.message}</p>}
              </div>

              {/* Workspace address — derived from company name */}
              <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5">
                <Globe className="h-4 w-4 shrink-0 text-gray-400" />
                <p className="flex-1 truncate font-mono text-[13px]">
                  <span className={slug ? "font-semibold text-gray-900" : "text-gray-400"}>
                    {slug || "yourcompany"}
                  </span>
                  <span className="text-gray-400">.scalist.io</span>
                </p>
                {slug.length >= 2 && (
                  slugPending ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
                  ) : slugCheck.data?.available === true ? (
                    <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" /> Available
                    </span>
                  ) : slugCheck.data?.available === false ? (
                    <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-red-500">
                      <XCircle className="h-4 w-4" /> Taken
                    </span>
                  ) : null
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">
                    Work email <span className="text-red-400">*</span>
                  </label>
                  <input {...register("email")} type="email" placeholder="hello@company.com" className={inputClass} />
                  {errors.email && <p className="text-[11px] text-red-500">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">
                    Phone <span className="text-red-400">*</span>
                  </label>
                  <input {...register("phone")} type="tel" placeholder="(555) 000-0000" className={inputClass} />
                  {errors.phone && <p className="text-[11px] text-red-500">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">Country</label>
                  <select
                    value={country}
                    onChange={(e) => { setCountry(e.target.value); setSelectedCity(null); }}
                    className={inputClass}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-gray-700">
                    City <span className="text-red-400">*</span>
                  </label>
                  <SingleCityAutocomplete
                    country={country.toLowerCase()}
                    value={selectedCity}
                    onChange={(v) => { setSelectedCity(v); if (v) setCityError(false); }}
                  />
                  {cityError && <p className="text-[11px] text-red-500">Select your city from the list</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-gray-700">Timezone</label>
                <select {...register("timezone")} className={inputClass}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={createWorkspace.isPending}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {createWorkspace.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating workspace…
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── STEP 1: Monthly volume ───────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5 rounded-2xl border border-gray-200/70 bg-white p-8 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">How many shoots per month?</h2>
                <p className="mt-1 text-[13px] text-gray-500">
                  A rough estimate is fine — this helps us tailor Scalist to your volume.
                </p>
              </div>

              <div className="space-y-2">
                {VOLUME_OPTIONS.map((opt) => {
                  const selected = volume === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVolume(opt.value)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all ${
                        selected
                          ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-600"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                        <p className="text-[12px] text-gray-500">{opt.caption}</p>
                      </div>
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                          selected ? "border-blue-600 bg-blue-600" : "border-gray-300 bg-white"
                        }`}
                      >
                        {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => onStep2Continue(true)}
                  className="px-4 py-2.5 text-sm text-gray-400 transition-colors hover:text-gray-600"
                >
                  Skip
                </button>
                <button
                  onClick={() => onStep2Continue(false)}
                  disabled={!volume || updateWorkspace.isPending}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  {updateWorkspace.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Invite team ──────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5 rounded-2xl border border-gray-200/70 bg-white p-8 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Invite your team</h2>
                <p className="mt-1 text-[13px] text-gray-500">
                  Each person gets an email with a link to set up their account. You can always add more later.
                </p>
              </div>

              <div className="space-y-2.5">
                {teammates.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={row.fullName}
                      onChange={(e) => setTeammate(i, { fullName: e.target.value })}
                      placeholder="Full name"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      value={row.email}
                      onChange={(e) => setTeammate(i, { email: e.target.value })}
                      type="email"
                      placeholder="email@company.com"
                      className={`${inputClass} flex-[1.2]`}
                    />
                    <select
                      value={row.role}
                      onChange={(e) => setTeammate(i, { role: e.target.value as InviteRoleValue })}
                      className={`${inputClass} w-[110px] shrink-0`}
                    >
                      {INVITE_ROLES.map((r) => (
                        <option key={r.label} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setTeammates((rows) => rows.filter((_, j) => j !== i))}
                      disabled={teammates.length === 1}
                      aria-label="Remove teammate"
                      className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-500 disabled:invisible"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setTeammates((rows) => [...rows, { ...EMPTY_ROW }])}
                className="flex items-center gap-1.5 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                <Plus className="h-4 w-4" /> Add another
              </button>

              {inviteStaff.error && (
                <p className="text-[12px] text-red-500">{inviteStaff.error.message}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => onFinish(true)}
                  disabled={isFinishing}
                  className="px-4 py-2.5 text-sm text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-40"
                >
                  Skip for now
                </button>
                <button
                  onClick={() => onFinish(false)}
                  disabled={isFinishing}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  {isFinishing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Setting up your dashboard…
                    </>
                  ) : (
                    <>
                      {teammates.some((t) => t.email.trim()) ? "Send invites & open dashboard" : "Go to dashboard"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <p className="text-[12px] leading-relaxed text-blue-700">
                  <strong>Your 3-month free trial has started.</strong> No credit card needed until you&apos;re ready
                  to upgrade.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

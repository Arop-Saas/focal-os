"use client";

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { StaffAvailabilityEditor } from "@/components/staff/staff-availability-editor";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import {
  User, Clock, DollarSign, Shield, MapPin, Briefcase,
  CheckCircle2, ChevronRight, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";

interface DayAvail {
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
}

interface StaffData {
  id: string;
  memberId: string;
  employeeId?: string | null;
  title?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  skills: string[];
  maxJobsPerDay: number;
  payType: string;
  payRate?: number | null;
  commissionRate?: number | null;
  mileageRate?: number | null;
  homeAddress?: string | null;
  homeTerritoryId?: string | null;
  jobRoleId?: string | null;
  member: {
    id: string;
    role: string;
    isOwner: boolean;
    user: {
      fullName: string;
      firstName?: string | null;
      lastName?: string | null;
      email: string;
      phone?: string | null;
      timezone?: string | null;
    };
  };
  jobAssignments: Array<{
    job: {
      id: string;
      jobNumber: string;
      propertyAddress: string;
      scheduledAt: Date | null;
      status: string;
    };
  }>;
}

const TABS = [
  { id: "profile",     label: "Profile",        icon: User },
  { id: "hours",       label: "Hours",          icon: Clock },
  { id: "pay",         label: "Pay & Services", icon: DollarSign },
  { id: "permissions", label: "Permissions",    icon: Shield },
  { id: "homebase",    label: "Home Base",      icon: MapPin },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Unified with onboarding: Member (standard staff role) or Admin.
// Legacy granular roles (Manager/Editor/VA/Viewer) still display honestly
// until their member is switched to one of these.
const ROLE_OPTIONS = [
  { value: "PHOTOGRAPHER", label: "Member", hint: "Standard team member — assigned shoots & own schedule" },
  { value: "ADMIN",        label: "Admin",  hint: "Full management access" },
];
const LEGACY_ROLE_LABELS: Record<string, string> = {
  MANAGER: "Manager", EDITOR: "Editor", VA: "Assistant", VIEWER: "Viewer",
};

const PAY_TYPES = [
  { value: "HOURLY",     label: "Hourly" },
  { value: "SALARY",     label: "Salary" },
  { value: "PER_JOB",    label: "Per Order" },
  { value: "COMMISSION", label: "Commission" },
];

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "America/Toronto",
  "America/Edmonton", "America/Vancouver", "America/Halifax", "Europe/London",
  "Australia/Sydney",
];

const SERVICES = [
  "Photography", "Video", "Drone", "3D Tour", "Floor Plan",
  "Virtual Staging", "Twilight", "Headshots", "Editing",
];

/** Transient per-card "Saved" indicator */
function useFlash(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return [
    on,
    () => {
      setOn(true);
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => setOn(false), 2000);
    },
  ];
}

function Card({ title, saved, saving, error, children }: {
  title: string;
  saved?: boolean;
  saving?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span
          aria-live="polite"
          className={cn(
            "flex items-center gap-1 text-[11px] font-medium transition-opacity",
            saving || saved || error ? "opacity-100" : "opacity-0"
          )}
        >
          {saving ? (
            <span className="flex items-center gap-1 text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>
          ) : error ? (
            <span className="text-red-500">{error}</span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Saved</span>
          )}
        </span>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children, htmlFor }: {
  label: string; hint?: string; children: React.ReactNode; htmlFor?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        checked ? "bg-blue-600" : "bg-gray-200"
      )}
    >
      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0")} />
    </button>
  );
}

export function TeamMemberSettings({ staff, initialAvailability }: {
  staff: StaffData;
  initialAvailability: DayAvail[];
}) {
  const [tab, setTab] = useState<TabId>("profile");

  // ── Profile state ──
  const [firstName, setFirstName] = useState(staff.member.user.firstName ?? "");
  const [lastName, setLastName]   = useState(staff.member.user.lastName ?? "");
  const [email, setEmail]         = useState(staff.member.user.email);
  const [phone, setPhone]         = useState(staff.member.user.phone ?? "");
  const [timezone, setTimezone]   = useState(staff.member.user.timezone ?? "America/New_York");
  const [title, setTitle]         = useState(staff.title ?? "");
  const [employeeId, setEmployeeId] = useState(staff.employeeId ?? "");
  const [bio, setBio]             = useState(staff.bio ?? "");
  const [jobRoleId, setJobRoleId] = useState(staff.jobRoleId ?? "");

  // ── Pay / services / hours / permissions / home base ──
  const [payType, setPayType]               = useState(staff.payType ?? "HOURLY");
  const [payRate, setPayRate]               = useState(String(staff.payRate ?? ""));
  const [commissionRate, setCommissionRate] = useState(String(staff.commissionRate ?? ""));
  const [mileageRate, setMileageRate]       = useState(String(staff.mileageRate ?? ""));
  const [services, setServices]             = useState<string[]>(staff.skills ?? []);
  const [maxJobs, setMaxJobs]               = useState(String(staff.maxJobsPerDay ?? "4"));
  const [role, setRole]                     = useState(staff.member.role);
  const [isActive, setIsActive]             = useState(staff.isActive);
  const [homeAddress, setHomeAddress]       = useState(staff.homeAddress ?? "");
  const [homeTerritoryId, setHomeTerritoryId] = useState(staff.homeTerritoryId ?? "");

  const [profileFlash, flashProfile] = useFlash();
  const [hoursFlash, flashHours]     = useFlash();
  const [payFlash, flashPay]         = useFlash();
  const [permFlash, flashPerm]       = useFlash();
  const [homeFlash, flashHome]       = useFlash();

  const territories = trpc.territories.list.useQuery();
  const jobTitles = trpc.staff.listRoles.useQuery();

  const updateProfile = trpc.staff.updateProfile.useMutation();
  const updateUser    = trpc.staff.updateUser.useMutation();
  const updateRole    = trpc.staff.updateRole.useMutation();

  const saving = updateProfile.isPending || updateUser.isPending || updateRole.isPending;
  const errMsg = updateProfile.error?.message ?? updateUser.error?.message ?? updateRole.error?.message;

  // ── Autosave helpers ──
  function saveUser(patch: Record<string, string | null>, flash: () => void) {
    updateUser.mutate({ memberId: staff.memberId, ...patch } as never, { onSuccess: flash });
  }
  function saveProfile(patch: Record<string, unknown>, flash: () => void) {
    updateProfile.mutate({ memberId: staff.memberId, ...patch } as never, { onSuccess: flash });
  }

  const initial = staff.member.user.fullName?.[0]?.toUpperCase() ?? "?";
  const roleLabel = staff.member.isOwner
    ? "Owner"
    : ROLE_OPTIONS.find((r) => r.value === role)?.label ?? LEGACY_ROLE_LABELS[role] ?? role;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        {/* Header card */}
        <div className="mb-6 flex items-center gap-5 rounded-xl border bg-white p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
            {staff.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={staff.avatarUrl} className="h-16 w-16 rounded-full object-cover" alt="" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold leading-tight text-gray-900">{staff.member.user.fullName}</p>
            <p className="text-sm text-gray-500">
              {title || roleLabel}
              {employeeId && <span className="ml-2 font-mono text-xs text-gray-400">#{employeeId}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>
              {isActive ? "Active" : "Inactive"}
            </span>
            <Toggle
              checked={isActive}
              label="Active member"
              onChange={(v) => { setIsActive(v); saveProfile({ isActive: v }, flashPerm); }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-6 md:flex-row">
          {/* Left rail */}
          <nav aria-label="Member settings" className="w-full shrink-0 space-y-0.5 md:w-48">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                  tab === id ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 space-y-4">
            {/* ── PROFILE ── */}
            {tab === "profile" && (
              <Card title="Profile" saved={profileFlash} saving={saving} error={errMsg}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="First name" htmlFor="tm-first">
                    <Input id="tm-first" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      onBlur={() => firstName !== (staff.member.user.firstName ?? "") && saveUser({ firstName }, flashProfile)} />
                  </Field>
                  <Field label="Last name" htmlFor="tm-last">
                    <Input id="tm-last" value={lastName} onChange={(e) => setLastName(e.target.value)}
                      onBlur={() => lastName !== (staff.member.user.lastName ?? "") && saveUser({ lastName }, flashProfile)} />
                  </Field>
                  <Field label="Email" hint={staff.member.isOwner ? "The owner's email can't be changed here" : undefined} htmlFor="tm-email">
                    <Input id="tm-email" type="email" value={email} disabled={staff.member.isOwner}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => !staff.member.isOwner && email !== staff.member.user.email && saveUser({ email }, flashProfile)}
                      className={staff.member.isOwner ? "bg-gray-50" : undefined} />
                  </Field>
                  <Field label="Phone" htmlFor="tm-phone">
                    <Input id="tm-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => phone !== (staff.member.user.phone ?? "") && saveUser({ phone: phone || null }, flashProfile)} />
                  </Field>
                  <Field label="Timezone" htmlFor="tm-tz">
                    <select id="tm-tz" value={timezone}
                      onChange={(e) => { setTimezone(e.target.value); saveUser({ timezone: e.target.value }, flashProfile); }}
                      className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
                    </select>
                  </Field>
                  <Field label="Member ID" hint="Shown on payouts & reports" htmlFor="tm-empid">
                    <Input id="tm-empid" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                      onBlur={() => employeeId !== (staff.employeeId ?? "") && saveProfile({ employeeId: employeeId || null }, flashProfile)}
                      placeholder="e.g. 0001" className="font-mono" />
                  </Field>
                  <Field label="Display title" hint="e.g. Lead Photographer" htmlFor="tm-title">
                    <Input id="tm-title" value={title} onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => title !== (staff.title ?? "") && saveProfile({ title }, flashProfile)} />
                  </Field>
                  <Field label="Job title tag" hint="Colored tag shown on the team list" htmlFor="tm-jobrole">
                    <div className="flex items-center gap-2">
                      <select id="tm-jobrole" value={jobRoleId}
                        onChange={(e) => { setJobRoleId(e.target.value); saveProfile({ jobRoleId: e.target.value || null }, flashProfile); }}
                        className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                        <option value="">None</option>
                        {(jobTitles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <Link href="/team/roles" className="shrink-0 text-xs text-blue-600 hover:underline">Manage</Link>
                    </div>
                  </Field>
                </div>
                <Field label="Bio / notes" htmlFor="tm-bio">
                  <textarea id="tm-bio" value={bio} rows={3} onChange={(e) => setBio(e.target.value)}
                    onBlur={() => bio !== (staff.bio ?? "") && saveProfile({ bio }, flashProfile)}
                    placeholder="Any notes about this team member…"
                    className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </Field>
              </Card>
            )}

            {/* ── HOURS ── */}
            {tab === "hours" && (
              <>
                <StaffAvailabilityEditor staffId={staff.id} staffName={staff.member.user.fullName ?? ""} initialAvailability={initialAvailability} />
                <Card title="Capacity" saved={hoursFlash} saving={saving} error={errMsg}>
                  <Field label="Max orders per day" hint="The scheduler won't book beyond this" htmlFor="tm-maxjobs">
                    <Input id="tm-maxjobs" type="number" min={1} max={20} value={maxJobs}
                      onChange={(e) => setMaxJobs(e.target.value)}
                      onBlur={() => {
                        const n = parseInt(maxJobs) || 4;
                        if (n !== staff.maxJobsPerDay) saveProfile({ maxJobsPerDay: n }, flashHours);
                      }}
                      className="w-28" />
                  </Field>
                </Card>
              </>
            )}

            {/* ── PAY & SERVICES ── */}
            {tab === "pay" && (
              <Card title="Pay & Services" saved={payFlash} saving={saving} error={errMsg}>
                <Field label="Pay type">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Pay type">
                    {PAY_TYPES.map((pt) => (
                      <button key={pt.value} role="radio" aria-checked={payType === pt.value}
                        onClick={() => { setPayType(pt.value); saveProfile({ payType: pt.value }, flashPay); }}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                          payType === pt.value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        )}>
                        {pt.label}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {(payType === "HOURLY" || payType === "SALARY" || payType === "PER_JOB") && (
                    <Field label={payType === "HOURLY" ? "Hourly rate ($)" : payType === "SALARY" ? "Salary ($/yr)" : "Rate per order ($)"} htmlFor="tm-payrate">
                      <Input id="tm-payrate" type="number" min={0} step="0.01" value={payRate} placeholder="0.00"
                        onChange={(e) => setPayRate(e.target.value)}
                        onBlur={() => saveProfile({ payRate: payRate ? parseFloat(payRate) : undefined }, flashPay)} />
                    </Field>
                  )}
                  {(payType === "COMMISSION" || payType === "PER_JOB") && (
                    <Field label="Commission rate (%)" htmlFor="tm-comm">
                      <Input id="tm-comm" type="number" min={0} max={100} value={commissionRate} placeholder="0"
                        onChange={(e) => setCommissionRate(e.target.value)}
                        onBlur={() => saveProfile({ commissionRate: commissionRate ? parseFloat(commissionRate) : undefined }, flashPay)} />
                    </Field>
                  )}
                  <Field label="Mileage rate ($/mi)" htmlFor="tm-mileage">
                    <Input id="tm-mileage" type="number" min={0} step="0.001" value={mileageRate} placeholder="0.67"
                      onChange={(e) => setMileageRate(e.target.value)}
                      onBlur={() => saveProfile({ mileageRate: mileageRate ? parseFloat(mileageRate) : undefined }, flashPay)} />
                  </Field>
                </div>
                <div className="border-t pt-5">
                  <p className="mb-1 text-sm font-medium text-gray-700">Enabled services</p>
                  <p className="mb-3 text-xs text-gray-400">Only these services can be assigned to this member</p>
                  <div className="flex flex-wrap gap-2">
                    {SERVICES.map((s) => {
                      const key = s.toLowerCase().replace(/ /g, "_");
                      const enabled = services.includes(key);
                      return (
                        <button key={s} role="checkbox" aria-checked={enabled}
                          onClick={() => {
                            const next = enabled ? services.filter((x) => x !== key) : [...services, key];
                            setServices(next);
                            saveProfile({ skills: next }, flashPay);
                          }}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                            enabled ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                          )}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* ── PERMISSIONS ── */}
            {tab === "permissions" && (
              <Card title="Role & Access" saved={permFlash} saving={saving} error={errMsg}>
                {staff.member.isOwner ? (
                  <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">
                    This member is the workspace owner and always has full access.
                  </p>
                ) : (
                  <>
                  {LEGACY_ROLE_LABELS[role] && (
                    <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-[12px] text-gray-500">
                      Current role: <span className="font-medium text-gray-700">{LEGACY_ROLE_LABELS[role]}</span> (legacy) — pick a role below to switch.
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Access role">
                    {ROLE_OPTIONS.map((r) => (
                      <button key={r.value} role="radio" aria-checked={role === r.value}
                        onClick={() => { setRole(r.value); updateRole.mutate({ memberId: staff.memberId, role: r.value as never }, { onSuccess: flashPerm }); }}
                        className={cn(
                          "rounded-lg border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                          role === r.value ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                        )}>
                        <p className={cn("text-sm font-semibold", role === r.value ? "text-blue-700" : "text-gray-800")}>{r.label}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{r.hint}</p>
                      </button>
                    ))}
                  </div>
                  </>
                )}
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Active member</p>
                    <p className="text-xs text-gray-400">Inactive members can't be assigned orders or log in</p>
                  </div>
                  <Toggle checked={isActive} label="Active member"
                    onChange={(v) => { setIsActive(v); saveProfile({ isActive: v }, flashPerm); }} />
                </div>
              </Card>
            )}

            {/* ── HOME BASE ── */}
            {tab === "homebase" && (
              <Card title="Home Base" saved={homeFlash} saving={saving} error={errMsg}>
                <Field label="Home address" hint="Travel times and mileage are calculated from here">
                  <AddressAutocomplete
                    value={homeAddress}
                    onChange={setHomeAddress}
                    onSelect={(r) => {
                      const full = [r.streetAddress, r.city, r.state, r.zip].filter(Boolean).join(", ");
                      setHomeAddress(full);
                      saveProfile({ homeAddress: full, homeLat: r.lat ?? null, homeLng: r.lng ?? null }, flashHome);
                    }}
                    placeholder="123 Main St, City"
                  />
                </Field>
                <Field label="Home territory" hint="The service territory this member primarily works" htmlFor="tm-territory">
                  <div className="flex items-center gap-2">
                    <select id="tm-territory" value={homeTerritoryId}
                      onChange={(e) => { setHomeTerritoryId(e.target.value); saveProfile({ homeTerritoryId: e.target.value || null }, flashHome); }}
                      className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                      <option value="">None</option>
                      {(territories.data ?? []).map((t: { id: string; name: string }) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <Link href="/territories" className="shrink-0 text-xs text-blue-600 hover:underline">Manage</Link>
                  </div>
                </Field>
              </Card>
            )}

            {/* Recent orders */}
            <section className="rounded-xl border bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Briefcase className="h-4 w-4 text-gray-400" /> Recent Orders
              </h3>
              {staff.jobAssignments.length === 0 ? (
                <p className="text-xs text-gray-400">No orders assigned yet.</p>
              ) : (
                <div className="divide-y">
                  {staff.jobAssignments.slice(0, 5).map(({ job }) => (
                    <Link key={job.id} href={`/jobs/${job.id}`}
                      className="-mx-2 flex items-center justify-between rounded-lg px-2 py-3 transition-colors hover:bg-gray-50">
                      <div>
                        <p className="truncate text-sm font-medium text-gray-800">{job.propertyAddress}</p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          #{job.jobNumber}
                          {job.scheduledAt ? " · " + format(new Date(job.scheduledAt), "MMM d, yyyy") : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

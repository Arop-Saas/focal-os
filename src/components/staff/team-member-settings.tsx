"use client";

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { StaffAvailabilityEditor } from "@/components/staff/staff-availability-editor";
import {
  User, Clock, DollarSign, Shield, Bell, MapPin, Plug,
  Camera, Loader2, CheckCircle2, ChevronRight, Briefcase,
  Sun, Moon, Hash, Palette, Smartphone, Globe, Mail,
  Phone, AlertCircle,
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
  serviceRegions: string[];
  maxJobsPerDay: number;
  payType: string;
  payRate?: number | null;
  commissionRate?: number | null;
  mileageRate?: number | null;
  homeAddress?: string | null;
  homeTerritoryId?: string | null;
  member: {
    id: string;
    role: string;
    isOwner: boolean;
    user: { fullName: string; email: string; phone?: string | null };
  };
  availability: DayAvail[];
  jobAssignments: Array<{
    job: {
      id: string;
      jobNumber: string;
      propertyAddress: string;
      scheduledAt: Date | null;
      status: string;
      client?: { firstName: string; lastName: string } | null;
    };
  }>;
}

const TABS = [
  { id: "profile",       label: "Profile",          icon: User },
  { id: "availability",  label: "Availability",     icon: Clock },
  { id: "pay",           label: "Pay & Work",       icon: DollarSign },
  { id: "permissions",   label: "Permissions",      icon: Shield },
  { id: "notifications", label: "Notifications",    icon: Bell },
  { id: "location",      label: "Location",         icon: MapPin },
  { id: "integrations",  label: "Integrations",     icon: Plug },
] as const;

type TabId = typeof TABS[number]["id"];

const ROLE_OPTIONS = ["PHOTOGRAPHER", "EDITOR", "MANAGER", "ADMIN", "VA", "VIEWER"];
const PAY_TYPES = [
  { value: "HOURLY",     label: "Hourly" },
  { value: "SALARY",     label: "Salary" },
  { value: "PER_JOB",    label: "Per Job" },
  { value: "COMMISSION", label: "Commission" },
];
const CALENDAR_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#ef4444",
  "#f97316","#eab308","#22c55e","#14b8a6",
];
const TIMEZONES = [
  "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "America/Phoenix","America/Anchorage","Pacific/Honolulu","Europe/London",
  "Europe/Paris","Asia/Tokyo","Australia/Sydney",
];
const SERVICES = [
  "Photography","Video","Drone","3D Tour","Floor Plan",
  "Virtual Staging","Twilight","Headshots","Editing",
];

function SaveBar({ isPending, saved, error, onSave }: {
  isPending: boolean; saved: boolean; error?: string; onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 mt-6 pt-5 border-t">
      <button
        onClick={onSave}
        disabled={isPending}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
        {saved ? "Saved!" : "Save changes"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ComingSoon() {
  return <span className="text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-2">Coming soon</span>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}
export function TeamMemberSettings({ staff, initialAvailability }: {
  staff: StaffData;
  initialAvailability: DayAvail[];
}) {
  const [tab, setTab] = useState<TabId>("profile");
  const [title, setTitle]         = useState(staff.title ?? "");
  const [bio, setBio]             = useState(staff.bio ?? "");
  const [employeeId, setEmployeeId] = useState(staff.employeeId ?? "");
  const [calendarColor, setCalendarColor] = useState(CALENDAR_COLORS[0]);
  const [timezone, setTimezone]   = useState("America/New_York");
  const [payType, setPayType]           = useState(staff.payType ?? "HOURLY");
  const [payRate, setPayRate]           = useState(String(staff.payRate ?? ""));
  const [commissionRate, setCommissionRate] = useState(String(staff.commissionRate ?? ""));
  const [mileageRate, setMileageRate]   = useState(String(staff.mileageRate ?? ""));
  const [services, setServices]         = useState<string[]>(staff.skills ?? []);
  const [maxJobs, setMaxJobs]           = useState(String(staff.maxJobsPerDay ?? "4"));
  const [role, setRole]       = useState(staff.member.role);
  const [isActive, setIsActive] = useState(staff.isActive);
  const [emailNotifs, setEmailNotifs]   = useState(true);
  const [pushNotifs, setPushNotifs]     = useState(true);
  const [smsNotifs, setSmsNotifs]       = useState(false);
  const [jobReminders, setJobReminders] = useState(true);
  const [scheduleChanges, setScheduleChanges] = useState(true);
  const [homeAddress, setHomeAddress] = useState(staff.homeAddress ?? "");
  const [morningTwilight, setMorningTwilight] = useState(false);
  const [eveningTwilight, setEveningTwilight] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [paySaved, setPaySaved]         = useState(false);
  const [permSaved, setPermSaved]       = useState(false);
  const [locSaved, setLocSaved]         = useState(false);

  const updateProfile = trpc.staff.updateProfile.useMutation({
    onSuccess: () => { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 3000); },
  });
  const updateRole = trpc.staff.updateRole.useMutation({
    onSuccess: () => { setPermSaved(true); setTimeout(() => setPermSaved(false), 3000); },
  });

  const handleSaveProfile = () => {
    updateProfile.mutate({ memberId: staff.memberId, title: title || undefined, bio: bio || undefined, employeeId: employeeId || undefined });
  };
  const handleSavePay = () => {
    updateProfile.mutate({
      memberId: staff.memberId, payType: payType as any,
      payRate: payRate ? parseFloat(payRate) : undefined,
      commissionRate: commissionRate ? parseFloat(commissionRate) : undefined,
      mileageRate: mileageRate ? parseFloat(mileageRate) : undefined,
      skills: services, maxJobsPerDay: parseInt(maxJobs) || 4,
    });
    setPaySaved(true); setTimeout(() => setPaySaved(false), 3000);
  };
  const handleSavePerms = () => {
    if (!staff.member.isOwner) updateRole.mutate({ memberId: staff.memberId, role: role as any });
    updateProfile.mutate({ memberId: staff.memberId, isActive });
  };
  const handleSaveLocation = () => {
    updateProfile.mutate({ memberId: staff.memberId, homeAddress: homeAddress || null });
    setLocSaved(true); setTimeout(() => setLocSaved(false), 3000);
  };

  const initial = staff.member.user.fullName?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-xl border p-5 mb-6 flex items-center gap-5">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {staff.avatarUrl ? <img src={staff.avatarUrl} className="h-16 w-16 rounded-full object-cover" alt="" /> : initial}
            </div>
            <button className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white border shadow flex items-center justify-center hover:bg-gray-50">
              <Camera className="h-3 w-3 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-lg leading-tight">{staff.member.user.fullName}</p>
            <p className="text-sm text-gray-500">{staff.title || staff.member.role}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                {isActive ? "Active" : "Inactive"}
              </span>
              {employeeId && <span className="text-xs text-gray-400 font-mono">#{employeeId}</span>}
            </div>
          </div>
          <div className="text-right text-sm text-gray-400 shrink-0"><p>{staff.member.user.email}</p></div>
        </div>

        <div className="flex gap-6">
          <nav className="w-48 shrink-0 space-y-0.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                  tab === id ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
                <Icon className="h-4 w-4 shrink-0" />{label}
              </button>
            ))}
          </nav>

          <div className="flex-1 min-w-0">
            {tab === "profile" && (
              <div className="bg-white rounded-xl border p-6 space-y-5">
                <h2 className="text-sm font-semibold text-gray-900">Profile Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Full Name" hint="Managed by the member"><Input value={staff.member.user.fullName} disabled className="bg-gray-50" /></Field>
                  <Field label="Email" hint="Managed by the member"><Input value={staff.member.user.email} disabled className="bg-gray-50" /></Field>
                  <Field label="Title" hint="e.g. Lead Photographer"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Lead Photographer" /></Field>
                  <Field label="Phone">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input value={staff.member.user.phone ?? ""} disabled className="pl-9 bg-gray-50" placeholder="Managed by member" />
                    </div>
                  </Field>
                  <Field label="Team Member ID" hint="Auto-assigned, can be changed">
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="e.g. 0001" className="pl-9 font-mono" />
                    </div>
                  </Field>
                  <Field label={"Timezone" as any}>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <select value={timezone} onChange={e => setTimezone(e.target.value)} disabled
                        className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 bg-gray-50 text-sm text-gray-500">
                        {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
                      </select>
                    </div>
                  </Field>
                </div>
                <Field label="Bio / Notes">
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                    placeholder="Any notes about this team member..."
                    className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none" />
                </Field>
                <SaveBar isPending={updateProfile.isPending} saved={profileSaved} error={updateProfile.error?.message} onSave={handleSaveProfile} />
              </div>
            )}

            {tab === "availability" && (
              <div className="space-y-4">
                <StaffAvailabilityEditor staffId={staff.id} staffName={staff.member.user.fullName ?? ""} initialAvailability={initialAvailability} />
                <div className="bg-white rounded-xl border p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-gray-900">Capacity</h2>
                  <Field label="Max Jobs Per Day"><Input type="number" min={1} max={20} value={maxJobs} onChange={e => setMaxJobs(e.target.value)} className="w-24" /></Field>
                </div>
                <div className="bg-white rounded-xl border p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-gray-900">Twilight Shoots</h2>
                  <div className="space-y-3">
                    {[
                      { icon: Sun, label: "Morning Twilight", hint: "Shoots before sunrise", val: morningTwilight, set: setMorningTwilight },
                      { icon: Moon, label: "Evening Twilight", hint: "Shoots after sunset", val: eveningTwilight, set: setEveningTwilight },
                    ].map(({ icon: Icon, label, hint, val, set }) => (
                      <div key={label} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-gray-400" />
                          <div><p className="text-sm font-medium text-gray-800">{label}</p><p className="text-xs text-gray-400">{hint}</p></div>
                        </div>
                        <button role="switch" aria-checked={val} onClick={() => set(!val)}
                          className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors", val ? "bg-blue-600" : "bg-gray-200")}>
                          <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", val ? "translate-x-4" : "translate-x-0")} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "pay" && (
              <div className="bg-white rounded-xl border p-6 space-y-6">
                <h2 className="text-sm font-semibold text-gray-900">Pay & Compensation</h2>
                <Field label="Pay Type">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PAY_TYPES.map(pt => (
                      <button key={pt.value} onClick={() => setPayType(pt.value)}
                        className={cn("px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                          payType === pt.value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                        {pt.label}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-3 gap-4">
                  {(payType === "HOURLY" || payType === "SALARY" || payType === "PER_JOB") && (
                    <Field label={payType === "HOURLY" ? "Hourly Rate ($)" : payType === "SALARY" ? "Salary ($/yr)" : "Rate per Job ($)"}>
                      <Input type="number" min={0} step="0.01" value={payRate} onChange={e => setPayRate(e.target.value)} placeholder="0.00" />
                    </Field>
                  )}
                  {(payType === "COMMISSION" || payType === "PER_JOB") && (
                    <Field label="Commission Rate (%)"><Input type="number" min={0} max={100} value={commissionRate} onChange={e => setCommissionRate(e.target.value)} placeholder="0" /></Field>
                  )}
                  <Field label="Mileage Rate ($/mi)"><Input type="number" min={0} step="0.001" value={mileageRate} onChange={e => setMileageRate(e.target.value)} placeholder="0.67" /></Field>
                </div>
                <div className="border-t pt-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Enabled Services</h3>
                  <div className="flex flex-wrap gap-2">
                    {SERVICES.map(s => {
                      const key = s.toLowerCase().replace(/ /g, "_");
                      const enabled = services.includes(key);
                      return (
                        <button key={s} onClick={() => setServices(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])}
                          className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                            enabled ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <SaveBar isPending={updateProfile.isPending} saved={paySaved} error={updateProfile.error?.message} onSave={handleSavePay} />
              </div>
            )}

            {tab === "permissions" && (
              <div className="bg-white rounded-xl border p-6 space-y-6">
                <h2 className="text-sm font-semibold text-gray-900">Role & Access</h2>
                <Field label="Role" hint="Controls what this member can see and do">
                  <div className="grid grid-cols-3 gap-2">
                    {ROLE_OPTIONS.map(r => (
                      <button key={r} disabled={staff.member.isOwner} onClick={() => setRole(r)}
                        className={cn("px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                          role === r ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300",
                          staff.member.isOwner && "opacity-50 cursor-not-allowed")}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                  {staff.member.isOwner && <p className="text-xs text-gray-400 mt-2">Owner role cannot be changed.</p>}
                </Field>
                <div className="border-t pt-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Account Status</h3>
                  <div className="flex items-center justify-between py-3 border rounded-lg px-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Active Member</p>
                      <p className="text-xs text-gray-400">Inactive members cannot be assigned to jobs or log in.</p>
                    </div>
                    <button role="switch" aria-checked={isActive} onClick={() => setIsActive(!isActive)}
                      className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors", isActive ? "bg-blue-600" : "bg-gray-200")}>
                      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", isActive ? "translate-x-4" : "translate-x-0")} />
                    </button>
                  </div>
                </div>
                <SaveBar isPending={updateProfile.isPending || updateRole.isPending} saved={permSaved} onSave={handleSavePerms} />
              </div>
            )}

            {tab === "notifications" && (
              <div className="bg-white rounded-xl border p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">Notification Preferences</h2>
                  <ComingSoon />
                </div>
                {[
                  { icon: Mail, label: "Email Notifications", hint: "Send updates to their email", val: emailNotifs, set: setEmailNotifs },
                  { icon: Smartphone, label: "Push Notifications", hint: "Mobile app push alerts", val: pushNotifs, set: setPushNotifs },
                  { icon: Phone, label: "SMS Notifications", hint: "Text message alerts", val: smsNotifs, set: setSmsNotifs },
                ].map(({ icon: Icon, label, hint, val, set }) => (
                  <div key={label} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-gray-400" />
                      <div><p className="text-sm font-medium text-gray-800">{label}</p><p className="text-xs text-gray-400">{hint}</p></div>
                    </div>
                    <button role="switch" aria-checked={val} onClick={() => set(!val)}
                      className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors", val ? "bg-blue-600" : "bg-gray-200")}>
                      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", val ? "translate-x-4" : "translate-x-0")} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Notification preferences will take effect once backend support is added.
                </div>
              </div>
            )}

            {tab === "location" && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-gray-900">Home Address</h2>
                  <Field label="Street Address">
                    <Input value={homeAddress} onChange={e => setHomeAddress(e.target.value)} placeholder="123 Main St, City, State ZIP" />
                  </Field>
                  <SaveBar isPending={updateProfile.isPending} saved={locSaved} error={updateProfile.error?.message} onSave={handleSaveLocation} />
                </div>
                <div className="bg-white rounded-xl border p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Territory Assignment</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Assign this member to a service territory.</p>
                    </div>
                    <Link href="/territories" className="text-xs text-blue-600 hover:underline">Manage territories →</Link>
                  </div>
                </div>
              </div>
            )}

            {tab === "integrations" && (
              <div className="space-y-4">
                {[
                  { icon: "📅", title: "Google Calendar", desc: "Sync jobs to Google Calendar." },
                  { icon: "📅", title: "Apple Calendar / iCloud", desc: "Sync via CalDAV." },
                  { icon: "🔷", title: "Outlook / Microsoft 365", desc: "Sync via Microsoft Graph API." },
                ].map(item => (
                  <div key={item.title} className="bg-white rounded-xl border p-5 flex items-center gap-4">
                    <div className="text-2xl">{item.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                        <ComingSoon />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                    <button disabled className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-400 cursor-not-allowed">Connect</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-gray-400" /> Recent Jobs
          </h3>
          {staff.jobAssignments.length === 0 ? (
            <p className="text-xs text-gray-400">No jobs assigned yet.</p>
          ) : (
            <div className="divide-y">
              {staff.jobAssignments.slice(0, 5).map(({ job }) => (
                <Link key={job.id} href={"/jobs/" + job.id}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate">{job.propertyAddress}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      #{job.jobNumber}
                      {job.scheduledAt ? " · " + format(new Date(job.scheduledAt), "MMM d, yyyy") : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

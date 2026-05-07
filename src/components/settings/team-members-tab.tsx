"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { hasRole } from "@/lib/roles";
import type { MemberRole } from "@prisma/client";
import {
  UserPlus,
  Loader2,
  ShieldCheck,
  Trash2,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

// ─── Role badge colours ────────────────────────────────────────────────────

const ROLE_COLORS: Record<MemberRole, string> = {
  OWNER:        "bg-violet-100 text-violet-800",
  ADMIN:        "bg-red-100 text-red-800",
  MANAGER:      "bg-orange-100 text-orange-800",
  PHOTOGRAPHER: "bg-blue-100 text-blue-800",
  EDITOR:       "bg-indigo-100 text-indigo-800",
  VA:           "bg-teal-100 text-teal-800",
  VIEWER:       "bg-gray-100 text-gray-600",
};

const ASSIGNABLE_ROLES: MemberRole[] = ["ADMIN","MANAGER","PHOTOGRAPHER","EDITOR","VA","VIEWER"];

// ─── Sub-components ───────────────────────────────────────────────────────

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", ROLE_COLORS[role])}>
      {role}
    </span>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

// ─── Invite Form ──────────────────────────────────────────────────────────

function InviteForm({ onSuccess }: { onSuccess: () => void }) {
  const [email,    setEmail]    = useState("");
  const [name,     setName]     = useState("");
  const [role,     setRole]     = useState<MemberRole>("PHOTOGRAPHER");
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const inviteMutation = api.staff.invite.useMutation({
    onSuccess: () => {
      setEmail(""); setName(""); setRole("PHOTOGRAPHER");
      setSuccess(true); setError(null);
      setTimeout(() => setSuccess(false), 4000);
      onSuccess();
    },
    onError: (e) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    inviteMutation.mutate({ email: email.trim(), fullName: name.trim(), role });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@studio.com"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle className="w-4 h-4 shrink-0" /> Invitation sent!
        </div>
      )}

      <button
        type="submit"
        disabled={inviteMutation.isPending || !email.trim() || !name.trim()}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 transition-colors"
      >
        {inviteMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UserPlus className="w-4 h-4" />
        )}
        Send Invitation
      </button>
    </form>
  );
}

// ─── Role Selector ────────────────────────────────────────────────────────

function RoleSelector({
  memberId,
  currentRole,
  canEdit,
  isOwner,
  onChanged,
}: {
  memberId: string;
  currentRole: MemberRole;
  canEdit: boolean;
  isOwner: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);

  const updateRole = api.staff.updateRole.useMutation({
    onSuccess: () => { setOpen(false); onChanged(); },
  });

  if (!canEdit || isOwner) {
    return <RoleBadge role={currentRole} />;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors",
          ROLE_COLORS[currentRole],
          "hover:opacity-80"
        )}
      >
        {currentRole}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 min-w-[140px]">
          {ASSIGNABLE_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              disabled={updateRole.isPending}
              onClick={() => updateRole.mutate({ memberId, role: r })}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors flex items-center gap-2",
                r === currentRole ? "text-blue-600" : "text-gray-700"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", ROLE_COLORS[r].split(" ")[0])} />
              {r}
              {r === currentRole && <CheckCircle className="w-3 h-3 ml-auto text-blue-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export function TeamMembersTab() {
  const { data: members = [], isLoading, refetch } = api.staff.list.useQuery({});
  const { data: myMembership } = api.workspace.getMyMembership.useQuery();

  const myRole     = myMembership?.role ?? null;
  const myMemberId = myMembership?.id;
  const canManage  = hasRole(myRole, "ADMIN");

  const removeMutation = api.staff.remove.useMutation({
    onSuccess: () => refetch(),
  });

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Current Members */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-800">Team Members</h4>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{members.length}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No team members yet.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const initials = (m.user.fullName ?? m.user.email ?? "?")
                .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              const isMe     = m.id === myMemberId;
              const isOwner  = m.isOwner;

              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                    isMe ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white hover:bg-gray-50"
                  )}
                >
                  <Avatar initials={initials} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {m.user.fullName ?? "—"}
                      </p>
                      {isMe && (
                        <span className="text-[10px] font-bold bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full">You</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{m.user.email}</p>
                  </div>

                  {/* Role (editable for admins on non-owners) */}
                  <RoleSelector
                    memberId={m.id}
                    currentRole={m.role}
                    canEdit={canManage && !isMe}
                    isOwner={isOwner}
                    onChanged={refetch}
                  />

                  {/* Remove */}
                  {canManage && !isMe && !isOwner && (
                    confirmRemove === m.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => { removeMutation.mutate({ memberId: m.id }); setConfirmRemove(null); }}
                          disabled={removeMutation.isPending}
                          className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                        >
                          {removeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                        </button>
                        <span className="text-gray-300">·</span>
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(m.id)}
                        title="Remove member"
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Role legend */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Role Permissions</p>
        <div className="space-y-1.5">
          {([
            ["OWNER",        "Full control. Manages Stripe, billing, and all settings."],
            ["ADMIN",        "Can manage workspace settings, invite/remove staff, and void invoices."],
            ["MANAGER",      "Can create/edit jobs, invoices, assign staff, and manage clients."],
            ["PHOTOGRAPHER", "Can view assigned jobs, update job status, and access galleries."],
            ["EDITOR",       "Can upload and manage photo galleries."],
            ["VA",           "Can manage clients, messages, and invoices."],
            ["VIEWER",       "Read-only access to the dashboard."],
          ] as [MemberRole, string][]).map(([r, desc]) => (
            <div key={r} className="flex items-start gap-2">
              <RoleBadge role={r} />
              <p className="text-xs text-gray-500 leading-tight pt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invite section (ADMIN+ only) */}
      {canManage && (
        <div className="border-t pt-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-800">Invite a Team Member</h4>
          </div>
          <InviteForm onSuccess={refetch} />
        </div>
      )}
    </div>
  );
}

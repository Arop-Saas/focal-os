"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { useCurrentRole } from "@/hooks/use-current-role";
import {
  MoreVertical,
  X,
  Search,
  Filter,
  Pencil,
  UserX,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-800",
  ADMIN: "bg-red-100 text-red-800",
  MANAGER: "bg-orange-100 text-orange-800",
  PHOTOGRAPHER: "bg-blue-100 text-blue-800",
  EDITOR: "bg-green-100 text-green-800",
  VA: "bg-yellow-100 text-yellow-800",
  VIEWER: "bg-gray-100 text-gray-800",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
};

const ROLES = ["All Roles", "OWNER", "ADMIN", "MANAGER", "PHOTOGRAPHER", "EDITOR", "VA", "VIEWER"];
const STATUSES = ["All Statuses", "Active", "Inactive"];

type TeamMember = {
  id: string;
  role: string;
  isOwner: boolean;
  joinedAt: Date;
  user: {
    fullName: string;
    email: string;
  };
  staffProfile?: {
    id?: string;
    isActive?: boolean;
  } | null;
};

export function TeamTable() {
  const { can } = useCurrentRole();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState("PHOTOGRAPHER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: members, isLoading } = trpc.staff.list.useQuery({});
  const inviteMutation = trpc.staff.invite.useMutation();

  const filtered = useMemo(() => {
    if (!members) return [];
    return members.filter((m: TeamMember) => {
      const isActive = m.staffProfile?.isActive !== false;
      const matchesSearch =
        !search ||
        m.user.fullName.toLowerCase().includes(search.toLowerCase()) ||
        m.user.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole =
        roleFilter === "All Roles" ||
        (m.isOwner ? "OWNER" : m.role) === roleFilter;
      const matchesStatus =
        statusFilter === "All Statuses" ||
        (statusFilter === "Active" ? isActive : !isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [members, search, roleFilter, statusFilter]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteFullName) return;
    setIsSubmitting(true);
    try {
      await inviteMutation.mutateAsync({
        email: inviteEmail,
        fullName: inviteFullName,
        role: inviteRole as any,
      });
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("PHOTOGRAPHER");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <p className="text-gray-500">Loading team members...</p>
      </div>
    );
  }

  return (
    <>
      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search team members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r === "All Roles" ? "All Roles" : r.charAt(0) + r.slice(1).toLowerCase()}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {!members || members.length === 0 ? (
        <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-base font-semibold text-gray-700">No team members yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your first team member to get started.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
          <p className="text-base font-semibold text-gray-700">No results found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Joined</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((member: TeamMember) => {
                  const initials = getInitials(member.user.fullName);
                  const isActive = member.staffProfile?.isActive !== false;
                  const displayRole = member.isOwner ? "OWNER" : member.role;
                  return (
                    <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {initials}
                          </div>
                          <p className="font-medium text-gray-900">{member.user.fullName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border",
                            ROLE_COLORS[displayRole] || "bg-gray-100 text-gray-800"
                          )}
                        >
                          {displayRole}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{member.user.email}</td>
                      <td className="px-4 py-3.5 text-gray-600">{formatDate(member.joinedAt)}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full",
                            isActive ? STATUS_COLORS["ACTIVE"] : STATUS_COLORS["INACTIVE"]
                          )}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="relative flex items-center gap-1">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="More actions"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-400" />
                          </button>
                          {openMenuId === member.id && (
                            <div className="absolute right-0 top-8 z-10 bg-white border rounded-lg shadow-lg py-1 w-44">
                              {member.staffProfile?.id && (
                                <Link
                                  href={`/staff/${member.staffProfile.id}`}
                                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  onClick={() => setOpenMenuId(null)}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit Settings
                                </Link>
                              )}
                              <button
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => setOpenMenuId(null)}
                              >
                                {isActive ? (
                                  <><UserX className="h-3.5 w-3.5" /> Deactivate</>
                                ) : (
                                  <><UserCheck className="h-3.5 w-3.5" /> Activate</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {openMenuId && (
        <div className="fixed inset-0 z-0" onClick={() => setOpenMenuId(null)} />
      )}
    </>
  );
}

// Keep old export name working too
export { TeamTable as StaffTable };

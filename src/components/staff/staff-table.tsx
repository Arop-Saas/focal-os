"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { Mail, MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

type StaffMember = {
  id: string;
  role: string;
  isOwner: boolean;
  joinedAt: Date;
  user: {
    fullName: string;
    email: string;
  };
  staffProfile?: {
    isActive?: boolean;
  } | null;
};

export function StaffTable() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState("PHOTOGRAPHER");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: members, isLoading } = trpc.staff.list.useQuery({});
  const inviteMutation = trpc.staff.invite.useMutation();

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
        <p className="text-gray-500">Loading staff...</p>
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="bg-white rounded-xl border flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">👥</div>
        <p className="text-base font-semibold text-gray-700">No team members yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Invite your first team member to get started.
        </p>
      </div>
    );
  }

  return (
    <>
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
              {members.map((member: StaffMember) => {
                const initials = getInitials(member.user.fullName);
                const isActive = member.staffProfile?.isActive !== false;
                return (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.user.fullName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border",
                          ROLE_COLORS[member.role] || "bg-gray-100 text-gray-800"
                        )}
                      >
                        {member.isOwner ? "OWNER" : member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-gray-600 text-sm">{member.user.email}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-gray-600 text-sm">{formatDate(member.joinedAt)}</p>
                    </td>
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
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Invite Team Member</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <Input
                  type="text"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="John Doe"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="john@example.com"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-0"
                >
                  <option value="PHOTOGRAPHER">Photographer</option>
                  <option value="EDITOR">Editor</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VA">Virtual Assistant</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !inviteEmail || !inviteFullName}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Inviting..." : "Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Button */}
      <div className="mt-4">
        <Button size="sm" onClick={() => setShowInviteModal(true)}>
          <Mail className="h-3.5 w-3.5 mr-1.5" /> Invite Member
        </Button>
      </div>
    </>
  );
}

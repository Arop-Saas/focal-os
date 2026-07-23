"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Same roles the onboarding wizard offers — "Member" is the standard staff role
const ROLE_OPTIONS = [
  { value: "PHOTOGRAPHER", label: "Member" },
  { value: "ADMIN", label: "Admin" },
];

export function AddTeamMemberButton() {
  const [showModal, setShowModal] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("PHOTOGRAPHER");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inviteMutation = trpc.staff.invite.useMutation();

  const valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    /^\S+@\S+\.\S+$/.test(email.trim()) &&
    phone.trim().length >= 7;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setIsSubmitting(true);
    try {
      await inviteMutation.mutateAsync({
        email: email.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        phone: phone.trim(),
        role: role as never,
      });
      setShowModal(false);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setRole("PHOTOGRAPHER");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setShowModal(true)}>
        <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add Team Member
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-lg font-semibold text-gray-900">Add Team Member</h2>
              <button onClick={() => setShowModal(false)} className="rounded p-1 transition-colors hover:bg-gray-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="inv-first" className="mb-1.5 block text-sm font-medium text-gray-700">
                    First name <span className="text-red-400">*</span>
                  </label>
                  <Input id="inv-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jordan" disabled={isSubmitting} required />
                </div>
                <div>
                  <label htmlFor="inv-last" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Last name <span className="text-red-400">*</span>
                  </label>
                  <Input id="inv-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Reyes" disabled={isSubmitting} required />
                </div>
              </div>
              <div>
                <label htmlFor="inv-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email <span className="text-red-400">*</span>
                </label>
                <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jordan@example.com" disabled={isSubmitting} required />
              </div>
              <div>
                <label htmlFor="inv-phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Phone <span className="text-red-400">*</span>
                </label>
                <Input id="inv-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" disabled={isSubmitting} required />
              </div>
              <div>
                <label htmlFor="inv-role" className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
                <select
                  id="inv-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              {inviteMutation.error && (
                <p className="text-sm text-red-600">{inviteMutation.error.message}</p>
              )}
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} disabled={isSubmitting}
                  className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || !valid}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {isSubmitting ? "Sending invite..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { PortalNav } from "@/components/portal/portal-nav";
import { User, Mail, Phone, Building2, CheckCircle2, Loader2 } from "lucide-react";

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
}

interface WorkspaceData {
  name: string;
  brandColor: string;
}

// This page fetches its own data client-side so it can also handle form state
export default function PortalProfilePage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const [client, setClient] = useState<ClientData | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/portal/me?slug=${params.workspaceSlug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.client) {
          setClient(data.client);
          setWorkspace(data.workspace);
          setFirstName(data.client.firstName ?? "");
          setLastName(data.client.lastName ?? "");
          setPhone(data.client.phone ?? "");
          setCompany(data.client.company ?? "");
        } else {
          window.location.href = `/portal/${params.workspaceSlug}`;
        }
      })
      .catch(() => {
        window.location.href = `/portal/${params.workspaceSlug}`;
      })
      .finally(() => setLoading(false));
  }, [params.workspaceSlug]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(`/api/portal/profile?slug=${params.workspaceSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone, company }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !client || !workspace) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <PortalNav
        workspaceSlug={params.workspaceSlug}
        workspaceName={workspace.name}
        clientName={`${client.firstName} ${client.lastName}`}
        brandColor={workspace.brandColor}
      />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your contact information.</p>
        </div>

        <div className="p-8 max-w-2xl">
          {/* Avatar / email block */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
              style={{ backgroundColor: workspace.brandColor }}>
              {client.firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">
                {client.firstName} {client.lastName}
              </p>
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                {client.email}
              </p>
              <p className="text-xs text-gray-400 mt-1">Email address cannot be changed here. Contact your studio.</p>
            </div>
          </div>

          {/* Edit form */}
          <form onSubmit={handleSave} className="bg-white border border-gray-100 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              Contact Details
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Brokerage / Team / Office
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Keller Williams Downtown"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              {saved ? (
                <span className="flex items-center gap-2 text-sm text-green-700 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Changes saved!
                </span>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ backgroundColor: workspace.brandColor }}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

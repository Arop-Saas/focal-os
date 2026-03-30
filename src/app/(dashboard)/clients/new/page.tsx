"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Header } from "@/components/layout/header";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewClientPage() {
  const router = useRouter();
  const createClient = trpc.clients.create.useMutation({
    onSuccess: (client) => router.push(`/clients/${client.id}`),
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    type: "AGENT" as const,
    city: "",
    state: "",
    country: "",
    notes: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createClient.mutateAsync({ ...form, tags: [] });
  }

  const inputCls = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="New Client" description="Add a new client to your workspace" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft className="h-4 w-4" /> Back to clients
          </Link>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 space-y-5">
            <h2 className="text-lg font-bold text-gray-900">Client details</h2>

            {createClient.error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {createClient.error.message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">First name <span className="text-red-400">*</span></label>
                <input name="firstName" value={form.firstName} onChange={handleChange} required placeholder="Jane" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Last name <span className="text-red-400">*</span></label>
                <input name="lastName" value={form.lastName} onChange={handleChange} required placeholder="Smith" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Email <span className="text-red-400">*</span></label>
                <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="jane@realty.com" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="(555) 000-0000" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Company</label>
                <input name="company" value={form.company} onChange={handleChange} placeholder="Keller Williams" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Client type</label>
                <select name="type" value={form.type} onChange={handleChange} className={inputCls}>
                  <option value="AGENT">Agent</option>
                  <option value="BROKER">Broker</option>
                  <option value="BUILDER">Builder</option>
                  <option value="HOMEOWNER">Homeowner</option>
                  <option value="PROPERTY_MANAGER">Property Manager</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input name="city" value={form.city} onChange={handleChange} placeholder="Nashville" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">State</label>
                <input name="state" value={form.state} onChange={handleChange} placeholder="TN" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <input name="country" value={form.country} onChange={handleChange} placeholder="US" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Any notes about this client..." className={inputCls} />
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/clients" className="flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={createClient.isPending}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {createClient.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {createClient.isPending ? "Creating…" : "Create client"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { Plus, Eye, Settings2, Trash2, Globe, Lock, Loader2 } from "lucide-react";

export function OrderFormList() {
  const router = useRouter();
  const { data: forms, isLoading, refetch } = api.orderForm.list.useQuery();
  const createMutation  = api.orderForm.create.useMutation();
  const deleteMutation  = api.orderForm.delete.useMutation();

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const form = await createMutation.mutateAsync({ title: newTitle.trim() });
    setCreating(false);
    setNewTitle("");
    router.push(`/order-form/${form.id}`);
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    await deleteMutation.mutateAsync({ id });
    setDeletingId(null);
    refetch();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {forms?.length ?? 0} form{forms?.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          {forms && forms.length > 0 && (
            <button
              onClick={() => router.push(`/order-form/${forms[0].id}?section=step-2`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Service
            </button>
          )}
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Order Form
          </button>
        </div>
      </div>

      {/* Create inline row */}
      {creating && (
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
            placeholder="Form title…"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreate}
            disabled={!newTitle.trim() || createMutation.isPending}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {createMutation.isPending ? "Creating…" : "Create"}
          </button>
          <button
            onClick={() => { setCreating(false); setNewTitle(""); }}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Empty state */}
      {!forms?.length && !creating && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="text-3xl mb-3">📋</div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">No order forms yet</h3>
          <p className="text-xs text-gray-400 mb-4">
            Create a form to share a branded booking page with your clients.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create your first form
          </button>
        </div>
      )}

      {/* Form list */}
      {(forms?.length ?? 0) > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <span>Title</span>
            <span>Visibility</span>
            <span className="pr-2">Actions</span>
          </div>

          {forms?.map((form, i) => (
            <div
              key={form.id}
              className={`grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-3.5 ${
                i < (forms.length - 1) ? "border-b border-gray-50" : ""
              } hover:bg-gray-50/50 transition-colors`}
            >
              {/* Title */}
              <div>
                <p className="text-sm font-medium text-gray-900">{form.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {form.confirmationMode === "IMMEDIATE" ? "Auto-confirm" : "Requires approval"} ·{" "}
                  {form.paymentMode === "NONE" ? "No upfront payment" : form.paymentMode === "FULL" ? "Full payment" : (form as any).depositType === "fixed" ? `$${(form as any).depositFixed ?? 100} deposit` : `${form.depositPercent ?? 25}% deposit`}
                </p>
              </div>

              {/* Visibility badge */}
              <div>
                {form.isPublic ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    <Globe className="w-3 h-3" /> Public
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    <Lock className="w-3 h-3" /> Private
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => router.push(`/order-form/${form.id}/preview`)}
                  title="View live form"
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => router.push(`/order-form/${form.id}`)}
                  title="Edit form"
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(form.id, form.title)}
                  disabled={deletingId === form.id}
                  title="Delete form"
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                >
                  {deletingId === form.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

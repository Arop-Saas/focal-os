"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, Users, Loader2, Check,
  ChevronDown, ChevronRight, Tag, AlertTriangle,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type DiscountType = "PERCENTAGE" | "FLAT";

interface GroupFormState {
  name:          string;
  discountType:  DiscountType;
  discountValue: string;
  notes:         string;
  isActive:      boolean;
}

const EMPTY_FORM: GroupFormState = {
  name: "", discountType: "PERCENTAGE", discountValue: "", notes: "", isActive: true,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function discountLabel(type: DiscountType, value: number) {
  return type === "PERCENTAGE" ? `${value}% off` : `${formatCurrency(value)} flat off`;
}

// ─── Group Form ─────────────────────────────────────────────────────────────

function GroupForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial:  GroupFormState;
  onSave:   (f: GroupFormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof GroupFormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const valid =
    form.name.trim().length > 0 &&
    !isNaN(parseFloat(form.discountValue)) &&
    parseFloat(form.discountValue) >= 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Group Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder='e.g. "RE/MAX Partners" or "VIP Brokers"'
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Discount Type</label>
          <select
            value={form.discountType}
            onChange={(e) => set("discountType", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FLAT">Flat Amount ($)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {form.discountType === "PERCENTAGE" ? "Discount (%)" : "Discount ($)"}
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max={form.discountType === "PERCENTAGE" ? "100" : undefined}
              step="0.01"
              value={form.discountValue}
              onChange={(e) => set("discountValue", e.target.value)}
              placeholder={form.discountType === "PERCENTAGE" ? "e.g. 10" : "e.g. 50.00"}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Internal notes about this pricing agreement..."
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="col-span-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => set("isActive", !form.isActive)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
              form.isActive ? "bg-blue-600" : "bg-gray-200"
            )}
          >
            <span className={cn(
              "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
              form.isActive ? "translate-x-4" : "translate-x-0"
            )} />
          </button>
          <span className="text-sm text-gray-700">Active — discount applied to new invoices</span>
        </div>
      </div>

      {/* Preview */}
      {valid && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          Preview: a $500 job becomes{" "}
          <strong>
            {formatCurrency(
              form.discountType === "PERCENTAGE"
                ? 500 * (1 - parseFloat(form.discountValue) / 100)
                : Math.max(0, 500 - parseFloat(form.discountValue))
            )}
          </strong>{" "}
          ({discountLabel(form.discountType, parseFloat(form.discountValue))} saved)
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={!valid || isSaving}
          onClick={() => onSave(form)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 transition-colors"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Group
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Group Row ───────────────────────────────────────────────────────────────

function GroupRow({
  group,
  onEdit,
  onDelete,
}: {
  group: {
    id: string;
    name: string;
    discountType: string;
    discountValue: number;
    isActive: boolean;
    notes: string | null;
    _count: { clients: number };
  };
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail } = api.brokerages.getById.useQuery(
    { id: group.id },
    { enabled: expanded }
  );

  return (
    <div className={cn("rounded-xl border transition-colors", group.isActive ? "border-gray-100 bg-white" : "border-dashed border-gray-200 bg-gray-50")}>
      <div className="flex items-center gap-3 p-4">
        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-400 hover:text-gray-600 shrink-0"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Icon */}
        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <Tag className="w-4 h-4 text-indigo-500" />
        </div>

        {/* Name + badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{group.name}</p>
            {!group.isActive && (
              <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">INACTIVE</span>
            )}
          </div>
          {group.notes && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{group.notes}</p>
          )}
        </div>

        {/* Discount pill */}
        <div className={cn(
          "shrink-0 text-xs font-bold px-2.5 py-1 rounded-full",
          group.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
        )}>
          {discountLabel(group.discountType as DiscountType, group.discountValue)}
        </div>

        {/* Client count */}
        <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
          <Users className="w-3.5 h-3.5" />
          {group._count.clients}
        </div>

        {/* Actions */}
        <button
          type="button"
          onClick={onEdit}
          className="text-gray-300 hover:text-blue-500 transition-colors shrink-0"
          title="Edit"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded client list */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          {!detail ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          ) : detail.clients.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">No clients assigned to this group yet.</p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Clients in this group ({detail.clients.length})
              </p>
              {detail.clients.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <span>{c.firstName} {c.lastName}</span>
                  {c.company && <span className="text-gray-400">· {c.company}</span>}
                  <span className="text-gray-300 text-xs">{c.email}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function BrokerageGroupsManager() {
  const { data: groups = [], isLoading, refetch } = api.brokerages.list.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const createMutation = api.brokerages.create.useMutation({
    onSuccess: () => { refetch(); setShowCreate(false); },
  });
  const updateMutation = api.brokerages.update.useMutation({
    onSuccess: () => { refetch(); setEditingId(null); },
  });
  const deleteMutation = api.brokerages.delete.useMutation({
    onSuccess: () => { refetch(); setDeletingId(null); },
  });

  function handleCreate(form: GroupFormState) {
    createMutation.mutate({
      name:          form.name.trim(),
      discountType:  form.discountType,
      discountValue: parseFloat(form.discountValue),
      notes:         form.notes.trim() || undefined,
      isActive:      form.isActive,
    });
  }

  function handleUpdate(id: string, form: GroupFormState) {
    updateMutation.mutate({
      id,
      name:          form.name.trim(),
      discountType:  form.discountType,
      discountValue: parseFloat(form.discountValue),
      notes:         form.notes.trim() || undefined,
      isActive:      form.isActive,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Intro */}
      <p className="text-sm text-gray-500">
        Create pricing groups for brokerages, teams, or corporate accounts. Clients in a group automatically
        receive their discount when an invoice is generated.
      </p>

      {/* Group list */}
      {groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((g) => {
            if (editingId === g.id) {
              const initForm: GroupFormState = {
                name:          g.name,
                discountType:  g.discountType as DiscountType,
                discountValue: String(g.discountValue),
                notes:         g.notes ?? "",
                isActive:      g.isActive,
              };
              return (
                <div key={g.id} className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-semibold text-blue-700 mb-3">Editing: {g.name}</p>
                  <GroupForm
                    initial={initForm}
                    onSave={(f) => handleUpdate(g.id, f)}
                    onCancel={() => setEditingId(null)}
                    isSaving={updateMutation.isPending}
                  />
                </div>
              );
            }

            return (
              <div key={g.id}>
                {deletingId === g.id ? (
                  <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="flex-1 text-red-800">
                      Delete <strong>{g.name}</strong>? All {g._count.clients} clients will be unlinked.
                    </p>
                    <button
                      onClick={() => deleteMutation.mutate({ id: g.id })}
                      disabled={deleteMutation.isPending}
                      className="text-xs font-semibold text-red-600 hover:text-red-800"
                    >
                      {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                    </button>
                    <button onClick={() => setDeletingId(null)} className="text-xs text-gray-400 hover:text-gray-600">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <GroupRow
                    group={g}
                    onEdit={() => { setEditingId(g.id); setShowCreate(false); }}
                    onDelete={() => setDeletingId(g.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {groups.length === 0 && !showCreate && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
          <Tag className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No pricing groups yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Add your first group to start offering brokerage-specific pricing.
          </p>
        </div>
      )}

      {/* Create form */}
      {showCreate ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-700 mb-3">New Pricing Group</p>
          <GroupForm
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
            isSaving={createMutation.isPending}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setShowCreate(true); setEditingId(null); }}
          className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Pricing Group
        </button>
      )}
    </div>
  );
}

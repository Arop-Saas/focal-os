"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import { Tag, ChevronDown, X, Loader2, Check } from "lucide-react";

interface BrokerageGroupSelectorProps {
  clientId:             string;
  initialGroupId:       string | null;
  initialGroupName:     string | null;
  initialDiscountType:  string | null;
  initialDiscountValue: number | null;
}

export function BrokerageGroupSelector({
  clientId,
  initialGroupId,
  initialGroupName,
  initialDiscountType,
  initialDiscountValue,
}: BrokerageGroupSelectorProps) {
  const [open,      setOpen]      = useState(false);
  const [groupId,   setGroupId]   = useState<string | null>(initialGroupId);
  const [groupName, setGroupName] = useState<string | null>(initialGroupName);
  const [discType,  setDiscType]  = useState<string | null>(initialDiscountType);
  const [discVal,   setDiscVal]   = useState<number | null>(initialDiscountValue);
  const [saved,     setSaved]     = useState(false);

  const { data: groups = [], isLoading } = api.brokerages.list.useQuery(undefined, {
    enabled: open,
  });

  const assignMutation = api.brokerages.assignClient.useMutation({
    onSuccess: (_, vars) => {
      if (vars.brokerageGroupId === null) {
        setGroupId(null); setGroupName(null); setDiscType(null); setDiscVal(null);
      } else {
        const g = groups.find((g) => g.id === vars.brokerageGroupId);
        if (g) {
          setGroupId(g.id); setGroupName(g.name);
          setDiscType(g.discountType); setDiscVal(g.discountValue);
        }
      }
      setOpen(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function discountLabel(type: string | null, value: number | null) {
    if (!type || value === null) return null;
    return type === "PERCENTAGE" ? `${value}% off` : `${formatCurrency(value)} off`;
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Pricing Group</h2>
          <p className="text-xs text-gray-400 mt-0.5">Assign to a brokerage group for automatic invoice discounts</p>
        </div>
        {saved && (
          <div className="flex items-center gap-1 text-xs text-green-700 font-medium">
            <Check className="w-3.5 h-3.5" /> Saved
          </div>
        )}
      </div>

      {/* Current assignment */}
      {groupId ? (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-900 truncate">{groupName}</p>
            {discountLabel(discType, discVal) && (
              <p className="text-xs text-indigo-600">{discountLabel(discType, discVal)} on invoices</p>
            )}
          </div>
          <button
            type="button"
            title="Remove from group"
            disabled={assignMutation.isPending}
            onClick={() => assignMutation.mutate({ clientId, brokerageGroupId: null })}
            className="text-indigo-300 hover:text-red-400 transition-colors shrink-0"
          >
            {assignMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400 mb-3">No pricing group assigned — standard rates apply.</p>
      )}

      {/* Dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Tag className="w-3.5 h-3.5" />
          {groupId ? "Change group" : "Assign to a group"}
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-72 py-1 max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ) : groups.length === 0 ? (
                <div className="px-4 py-4 text-xs text-gray-400 text-center">
                  No pricing groups yet. Create them in Settings → Brokerage Pricing Groups.
                </div>
              ) : (
                <>
                  {groups.filter((g) => g.isActive).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      disabled={assignMutation.isPending}
                      onClick={() => assignMutation.mutate({ clientId, brokerageGroupId: g.id })}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left",
                        g.id === groupId && "bg-indigo-50"
                      )}
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                        <p className="text-xs text-gray-400">
                          {g.discountType === "PERCENTAGE"
                            ? `${g.discountValue}% off`
                            : `${formatCurrency(g.discountValue)} flat off`}
                          {" · "}
                          {g._count.clients} client{g._count.clients !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {g.id === groupId && (
                        <Check className="w-4 h-4 text-indigo-500 shrink-0" />
                      )}
                    </button>
                  ))}
                  {groups.filter((g) => !g.isActive).length > 0 && (
                    <p className="text-[10px] text-gray-300 px-3 py-1 border-t">
                      {groups.filter((g) => !g.isActive).length} inactive group(s) hidden
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

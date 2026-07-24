"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { PRODUCTION_STATUS_META } from "./status-meta";

/**
 * Production tasks with inline status control. Rendered on the Overview and
 * Production tabs of the order command center; status changes feed straight
 * into the derived order stage (lib/orders/stage.ts).
 */

const STATUS_ORDER = ["WAITING_FILES", "QUEUED", "IN_PROGRESS", "QA", "REVISION", "READY"] as const;

export interface ProductionTaskRow {
  id: string;
  title: string;
  typeLabel: string;
  status: string;
  assigneeName: string | null;
  dueLabel: string | null;
  overdue: boolean;
}

export function ProductionTaskList({ tasks }: { tasks: ProductionTaskRow[] }) {
  const router = useRouter();
  const update = trpc.jobs.updateProductionTask.useMutation({
    onSuccess: () => router.refresh(),
  });

  if (tasks.length === 0) {
    return (
      <p className="text-[13px] text-gray-400">
        No production tasks yet. Tasks are generated from catalog items that include production work.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {tasks.map((t) => {
        const meta = PRODUCTION_STATUS_META[t.status] ?? PRODUCTION_STATUS_META.WAITING_FILES;
        return (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 border-b border-gray-50 pb-2.5 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-gray-800">{t.title}</p>
              <p className="text-[11px] text-gray-400">
                {t.typeLabel}
                {t.assigneeName && <> · {t.assigneeName}</>}
                {t.dueLabel && (
                  <>
                    {" · "}
                    <span className={t.overdue ? "font-medium text-red-600" : undefined}>
                      due {t.dueLabel}
                    </span>
                  </>
                )}
              </p>
            </div>
            <select
              value={t.status}
              disabled={update.isPending}
              onChange={(e) => update.mutate({ taskId: t.id, status: e.target.value as (typeof STATUS_ORDER)[number] })}
              className={cn(
                "shrink-0 cursor-pointer appearance-none rounded-full border px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide outline-none transition-opacity disabled:opacity-50",
                meta.cls
              )}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {PRODUCTION_STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

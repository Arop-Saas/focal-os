import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Saved views for the Orders operations inbox. Pure URL navigation —
 * ?view=… — so views are shareable and the back button works.
 */

export const ORDER_VIEWS = [
  { key: "needs_attention", label: "Needs attention" },
  { key: "today",           label: "Today" },
  { key: "upcoming",        label: "Upcoming" },
  { key: "unscheduled",     label: "Unscheduled" },
  { key: "production",      label: "In production" },
  { key: "qa",              label: "Quality check" },
  { key: "unpaid",          label: "Unpaid" },
  { key: "delivered",       label: "Delivered" },
  { key: "cancelled",       label: "Cancelled" },
  { key: "all",             label: "All orders" },
] as const;

export type OrderViewKey = (typeof ORDER_VIEWS)[number]["key"];

export function OrderViews({
  active,
  counts,
  searchParams,
}: {
  active: OrderViewKey;
  counts: Partial<Record<OrderViewKey, number>>;
  /** current URL params — everything except view/page is preserved across view switches */
  searchParams: Record<string, string | undefined>;
}) {
  function hrefFor(view: OrderViewKey) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "view" && key !== "page") params.set(key, value);
    }
    if (view !== "needs_attention") params.set("view", view);
    const qs = params.toString();
    return qs ? `/jobs?${qs}` : "/jobs";
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="Order views">
      {ORDER_VIEWS.map((v) => {
        const isActive = v.key === active;
        const count = counts[v.key];
        const emphasize = v.key === "needs_attention" && (count ?? 0) > 0;
        return (
          <Link
            key={v.key}
            href={hrefFor(v.key)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              isActive
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            )}
          >
            {v.label}
            {count != null && count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] font-bold leading-4",
                  isActive
                    ? "bg-white/20 text-white"
                    : emphasize
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-500"
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

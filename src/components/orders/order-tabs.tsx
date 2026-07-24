"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIM_BADGE } from "./status-meta";

/**
 * Client shell of the order command center: sticky identity header, status
 * dimension badges, derived progress line, and the six-tab switcher. All tab
 * content is server-rendered and passed in as panels — this component only
 * owns which panel is visible.
 */

export interface OrderTabDef {
  key: string;
  label: string;
}

interface OrderTabsProps {
  address: string;
  metaLine: string;
  isRush: boolean;
  /** index into progressSteps; -1 = nothing filled */
  progressStep: number;
  progressSteps: string[];
  /** ON_HOLD / CANCELLED hide the progress line */
  showProgress: boolean;
  tabs: OrderTabDef[];
  initialTab: string;
  panels: Record<string, ReactNode>;
  headerActions: ReactNode;
  /** rendered next to the address title (e.g. edit-address pencil) */
  titleAction?: ReactNode;
  /** tab keys whose panel should span the full width */
  wideTabs?: string[];
}

export function OrderTabs({
  address,
  metaLine,
  isRush,
  progressStep,
  progressSteps,
  showProgress,
  tabs,
  initialTab,
  panels,
  headerActions,
  titleAction,
  wideTabs = [],
}: OrderTabsProps) {
  const validInitial = tabs.some((t) => t.key === initialTab) ? initialTab : tabs[0].key;
  const [active, setActive] = useState(validInitial);
  // Header shrinks once scrolled away from the top and expands back at the top
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const next = e.currentTarget.scrollTop > 24;
    if (next !== compactRef.current) {
      compactRef.current = next;
      setCompact(next);
    }
  };

  const switchTab = (key: string) => {
    setActive(key);
    // Keep the URL shareable without triggering a server re-render
    const url = new URL(window.location.href);
    if (key === tabs[0].key) url.searchParams.delete("tab");
    else url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
      <div className="flex-1 overflow-y-auto" onScroll={onScroll}>
        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className={cn("mx-auto max-w-6xl px-6 pb-0 transition-all", compact ? "pt-2" : "pt-4")}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {!compact && (
                  <Link
                    href="/jobs"
                    className="mb-1 flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-600"
                  >
                    <ArrowLeft className="h-3 w-3" /> Orders
                  </Link>
                )}
                <div className="flex items-center gap-2.5">
                  <h1 className={cn("truncate font-semibold text-gray-900 transition-all", compact ? "text-base" : "text-xl")}>
                    {address}
                  </h1>
                  {titleAction}
                  {isRush && (
                    <span className={cn(DIM_BADGE, "border-red-200 bg-red-50 text-red-700 shrink-0")}>
                      <Zap className="h-2.5 w-2.5" /> Rush
                    </span>
                  )}
                </div>
                {!compact && <p className="mt-0.5 truncate text-[13px] text-gray-400">{metaLine}</p>}
              </div>
              <div className={cn("flex shrink-0 items-center gap-2", compact ? "pt-0" : "pt-4")}>
                {headerActions}
              </div>
            </div>

            {/* Progress line */}
            {showProgress && !compact && (
              <div className="mt-4 flex items-center gap-1">
                {progressSteps.map((s, i) => (
                  <div key={s} className="flex-1">
                    <div className={cn("h-1 rounded-full", i <= progressStep ? "bg-blue-600" : "bg-gray-200")} />
                    <p
                      className={cn(
                        "mt-1 text-center text-[9px] font-medium uppercase tracking-wide",
                        i <= progressStep ? "text-blue-600" : "text-gray-300"
                      )}
                    >
                      {s}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="mt-2 flex items-center gap-0.5">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => switchTab(t.key)}
                  className={cn(
                    "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
                    active === t.key
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Active panel ── */}
        <div className={cn("mx-auto px-6 py-5", wideTabs.includes(active) ? "max-w-none" : "max-w-6xl")}>
          {panels[active]}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
  emoji: string;
}

interface Props {
  steps: SetupStep[];
  bookingUrl: string;
}

export function SetupChecklist({ steps, bookingUrl }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (dismissed) return null;

  const copyBookingLink = () => {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden transition-all",
      allDone ? "border-green-200 bg-green-50" : "border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50"
    )}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {allDone ? (
            <div className="text-2xl shrink-0">🎉</div>
          ) : (
            <div className="relative shrink-0">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e0e7ff" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="#3b82f6" strokeWidth="3"
                  strokeDasharray={`${(doneCount / steps.length) * 94} 94`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-blue-700">
                {doneCount}/{steps.length}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {allDone ? "You're all set!" : "Finish setting up your workspace"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {allDone
                ? "Your studio is fully configured and ready to go."
                : `${steps.length - doneCount} step${steps.length - doneCount !== 1 ? "s" : ""} left to get fully set up`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {allDone && (
            <button onClick={() => setDismissed(true)}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-white/60"
              title="Dismiss">
              <X className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-white/60">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {!allDone && (
        <div className="px-5 pb-3">
          <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      {!collapsed && (
        <div className="px-5 pb-5 space-y-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                step.done ? "bg-white/50" : "bg-white shadow-sm border border-white"
              )}
            >
              <div className="shrink-0">
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{step.emoji}</span>
                  <p className={cn(
                    "text-sm font-semibold",
                    step.done ? "text-gray-400 line-through" : "text-gray-800"
                  )}>
                    {step.title}
                  </p>
                </div>
                {!step.done && (
                  <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                )}
              </div>

              {!step.done && (
                <Link
                  href={step.href}
                  className="shrink-0 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {step.cta} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}

          {/* Booking link tip — always shown */}
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-white/50">
            <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🔗</span>
                <p className="text-sm font-semibold text-gray-800">Share your booking link</p>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate font-mono">{bookingUrl}</p>
            </div>
            <button
              onClick={copyBookingLink}
              className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

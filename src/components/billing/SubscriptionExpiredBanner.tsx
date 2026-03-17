"use client";

import Link from "next/link";
import { Clock, AlertTriangle } from "lucide-react";

interface Props {
  trialDaysLeft: number | null;
  graceDaysLeft: number | null;
}

export function SubscriptionExpiredBanner({ trialDaysLeft, graceDaysLeft }: Props) {
  if (graceDaysLeft !== null) {
    // Grace period — urgent amber/red warning
    const isLastDay = graceDaysLeft === 0;
    return (
      <div className={`flex items-center justify-between gap-3 px-5 py-2.5 text-sm ${
        isLastDay
          ? "bg-red-600 text-white"
          : "bg-amber-500 text-white"
      }`}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            {isLastDay
              ? "Your account will be locked today — "
              : `${graceDaysLeft} day${graceDaysLeft === 1 ? "" : "s"} until your account is locked — `}
          </span>
          <span>Subscribe now to keep access to all your data.</span>
        </div>
        <Link
          href="/billing"
          className="shrink-0 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg font-semibold text-xs transition-colors"
        >
          Subscribe →
        </Link>
      </div>
    );
  }

  if (trialDaysLeft !== null) {
    // Trial running — soft blue notice
    if (trialDaysLeft > 5) return null; // Don't show banner if plenty of time left
    const isLastDay = trialDaysLeft === 0;
    return (
      <div className="flex items-center justify-between gap-3 bg-blue-600 text-white px-5 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            {isLastDay
              ? "Your free trial ends today — "
              : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your trial — `}
          </span>
          <span>Add a payment method to keep using FocalOS.</span>
        </div>
        <Link
          href="/billing"
          className="shrink-0 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg font-semibold text-xs transition-colors"
        >
          Choose a plan →
        </Link>
      </div>
    );
  }

  return null;
}

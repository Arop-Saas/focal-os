"use client";

import { useState } from "react";
import { Loader2, CreditCard } from "lucide-react";

interface Props {
  payToken: string;
  brandColor: string;
}

export function DirectPayButton({ payToken, brandColor }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payToken, source: "pay-page" }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Payment failed");
      window.location.href = data.url!;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60"
        style={{ background: brandColor }}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )}
        {loading ? "Redirecting to checkout…" : "Pay Now with Card"}
      </button>
      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}
      <p className="text-center text-[11px] text-gray-400">
        Secure payment powered by Stripe
      </p>
    </div>
  );
}

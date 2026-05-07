"use client";

import { useState } from "react";
import { Loader2, CreditCard } from "lucide-react";

interface InvoicePayButtonProps {
  invoiceId: string;
  brandColor: string;
}

export function InvoicePayButton({ invoiceId, brandColor }: InvoicePayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment error");
      window.location.href = data.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment failed";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handlePay}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-60 transition-opacity"
        style={{ backgroundColor: brandColor }}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <CreditCard className="w-3 h-3" />
        )}
        Pay Now
      </button>
      {error && <p className="text-[10px] text-red-500 max-w-[120px] text-right">{error}</p>}
    </div>
  );
}

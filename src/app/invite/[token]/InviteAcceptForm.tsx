"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  token: string;
  email: string;
  brandColor: string;
};

export default function InviteAcceptForm({ token, email, brandColor }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      // Call our API to create the account + workspace member
      const res = await fetch("/api/staff/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      // Auto sign in with the new password
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Account created but sign-in failed — send them to login
        router.replace("/mobile/login");
        return;
      }

      // Redirect to mobile app
      router.replace("/mobile/jobs");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email (read-only) */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={email}
          readOnly
          className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 text-sm cursor-not-allowed"
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:border-transparent pr-12"
            style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Confirm password */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          Confirm Password
        </label>
        <input
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter your password"
          required
          className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
        />
      </div>

      {/* Strength hint */}
      {password.length > 0 && (
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                background:
                  password.length >= i * 3
                    ? i <= 1 ? "#ef4444"
                    : i <= 2 ? "#f59e0b"
                    : i <= 3 ? "#3b82f6"
                    : brandColor
                    : "#e2e8f0",
              }}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: brandColor }}
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Setting up your account…
          </>
        ) : (
          "Activate Account & Continue →"
        )}
      </button>
    </form>
  );
}

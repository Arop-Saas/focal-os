"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Aperture, Mail, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";

function PortalLanding() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceSlug = params?.workspaceSlug as string;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authError = searchParams?.get("error");

  useEffect(() => {
    if (authError === "expired") setError("Your sign-in link has expired. Please request a new one.");
    else if (authError === "unauthorized") setError("Please sign in to access your portal.");
    else if (authError === "invalid") setError("Invalid sign-in link. Please request a new one.");
  }, [authError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), workspaceSlug }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Something went wrong");
      }

      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Login card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 bg-white">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Aperture className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Client Portal</span>
          </div>

          {!sent ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in</h1>
              <p className="text-sm text-gray-500 mb-8">
                Enter your email and we&apos;ll send you a sign-in link.
              </p>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-5 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Send sign-in link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-400 text-center">
                  Don&apos;t have an account? Contact your studio to get set up.
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
              <p className="text-sm text-gray-500 mb-6">
                We sent a sign-in link to <strong>{email}</strong>. Click it to access your portal.
              </p>
              <p className="text-xs text-gray-400">
                Link expires in 15 minutes. Check your spam folder if you don&apos;t see it.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="mt-6 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Hero */}
      <div className="hidden lg:flex flex-1 bg-[#0c1e3d] flex-col items-center justify-center px-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative text-center max-w-sm">
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-400/20">
            <Aperture className="w-8 h-8 text-blue-300" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Your Client Portal</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            View your orders, access delivered photos, pay invoices, and book new shoots — all in one place.
          </p>

          <div className="space-y-3 text-left">
            {[
              "Book new shoots online",
              "Track your order status",
              "Download delivered photos",
              "View and pay invoices",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-300">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense>
      <PortalLanding />
    </Suspense>
  );
}

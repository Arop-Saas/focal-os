"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Aperture, Mail, ArrowRight, AlertCircle,
  LogIn, UserPlus, ClipboardList, ChevronLeft, User, Phone, Lock, Eye, EyeOff,
} from "lucide-react";
import { DEFAULT_PORTAL_SETTINGS, type PortalSettings } from "@/lib/booking-form-types";

type View = "options" | "signin" | "no-account" | "forgot";

interface WorkspacePortalData {
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string;
  phone: string | null;
  email: string | null;
  portalSettings: PortalSettings | null;
  orderForms: { id: string; title: string; description: string | null; coverImage: string | null }[];
}

function PortalLanding() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceSlug = params?.workspaceSlug as string;

  const [view, setView] = useState<View>("options");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WorkspacePortalData | null>(null);

  // Sign-in fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password fields
  const [forgotEmail, setForgotEmail] = useState("");

  // Sign-up fields
  const [reqFirstName, setReqFirstName] = useState("");
  const [reqLastName, setReqLastName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqPhone, setReqPhone] = useState("");
  const [reqCompany, setReqCompany] = useState("");
  const [reqPassword, setReqPassword] = useState("");
  const [reqPasswordConfirm, setReqPasswordConfirm] = useState("");
  const [showReqPassword, setShowReqPassword] = useState(false);

  // Fetch workspace portal settings
  useEffect(() => {
    if (!workspaceSlug) return;
    fetch(`/api/portal/settings?slug=${encodeURIComponent(workspaceSlug)}`)
      .then((r) => r.json())
      .then((data) => { if (data.name) setWs(data); })
      .catch(() => {});
  }, [workspaceSlug]);

  const authError = searchParams?.get("error");
  useEffect(() => {
    if (authError === "expired") {
      setError("Your session has expired. Please sign in again.");
      setView("signin");
    } else if (authError === "unauthorized") {
      setError("Please sign in to access your portal.");
      setView("signin");
    } else if (authError === "invalid") {
      setError("Invalid sign-in attempt. Please try again.");
      setView("signin");
    }
  }, [authError]);

  // Merged settings: saved portal settings → defaults
  const ps: PortalSettings = { ...DEFAULT_PORTAL_SETTINGS, ...(ws?.portalSettings ?? {}) };
  const brandColor = ws?.brandColor ?? "#1B4F9E";
  const workspaceName = ws?.name ?? "Client Portal";
  const heroImage = ps.heroImageUrl;
  const welcomeTitle = ps.welcomeTitle || "Welcome";
  const welcomeText = ps.welcomeText || `Hi there! Welcome to the ${workspaceName.toLowerCase()} client portal. How can we help you today?`;
  const contactPhone = ps.contactPhone || ws?.phone || "";
  const contactEmail = ps.contactEmail || ws?.email || "";
  const bullets = ps.featureBullets ?? DEFAULT_PORTAL_SETTINGS.featureBullets!;
  const showLogin = ps.showLogin !== false;
  const showRegister = ps.showRegister !== false;
  const showOrderForms = ps.showOrderForms !== false;
  const cardStyle = ps.portalCardStyle ?? "list";
  const layout = ps.layout ?? "split";
  const orderForms = ws?.orderForms ?? [];

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, workspaceSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      if (data.redirectUrl) { window.location.href = data.redirectUrl; return; }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim(), workspaceSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      if (data.redirectUrl) window.location.href = data.redirectUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (reqPassword !== reqPasswordConfirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: reqFirstName.trim(), lastName: reqLastName.trim(),
          email: reqEmail.trim(), phone: reqPhone.trim(),
          company: reqCompany.trim(), password: reqPassword, workspaceSlug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      if (data.redirectUrl) window.location.href = data.redirectUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-colors";

  // ── Shared form card (left side content) ──────────────────────────────────
  const formContent = (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        {ws?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ws.logoUrl} alt={workspaceName} className="h-9 w-auto object-contain" />
        ) : (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: brandColor }}>
            {workspaceName[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <span className="text-lg font-bold text-gray-900">{workspaceName}</span>
      </div>

      {/* ── OPTIONS VIEW ── */}
      {view === "options" && (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{welcomeTitle}</h1>
          <p className="text-sm text-gray-500 mb-8">{welcomeText}</p>

          {(contactPhone || contactEmail) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-6 text-xs text-gray-400">
              {contactPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contactPhone}</span>}
              {contactEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {contactEmail}</span>}
            </div>
          )}

          <div className="space-y-3">
            {showLogin && (
              <button onClick={() => setView("signin")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors" style={{ backgroundColor: `${brandColor}15` }}>
                  <LogIn className="w-4 h-4" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">I have an account</p>
                  <p className="text-xs text-gray-500 mt-0.5">Sign in with your email and password.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-blue-400 transition-colors" />
              </button>
            )}

            {showRegister && (
              <button onClick={() => setView("no-account")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors" style={{ backgroundColor: `${brandColor}15` }}>
                  <UserPlus className="w-4 h-4" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">I do not have an account</p>
                  <p className="text-xs text-gray-500 mt-0.5">Create an account to get started.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-blue-400 transition-colors" />
              </button>
            )}

            {/* Order form cards — list style */}
            {showOrderForms && cardStyle === "list" && orderForms.length > 0 && orderForms.map((of) => (
              <a key={of.id} href={`/book/${workspaceSlug}?form=${of.id}`}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors" style={{ backgroundColor: `${brandColor}15` }}>
                  <ClipboardList className="w-4 h-4" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{of.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{of.description || "Place a new order"}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-blue-400 transition-colors" />
              </a>
            ))}

            {/* Order form cards — image grid style */}
            {showOrderForms && cardStyle === "imageGrid" && orderForms.length > 0 && (
              <div className="grid grid-cols-2 gap-3 w-full">
                {orderForms.map((of) => (
                  <a key={of.id} href={`/book/${workspaceSlug}?form=${of.id}`}
                    className="rounded-xl border border-gray-200 overflow-hidden hover:border-blue-400 hover:shadow-md transition-all group"
                  >
                    {of.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={of.coverImage} alt={of.title} className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-28 flex items-center justify-center" style={{ backgroundColor: `${brandColor}10` }}>
                        <ClipboardList className="w-8 h-8" style={{ color: `${brandColor}40` }} />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-sm font-semibold text-gray-900 truncate">{of.title}</p>
                      {of.description && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{of.description}</p>}
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium mt-2 transition-colors" style={{ color: brandColor }}>
                        Order now <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* Fallback: single "Place an order" link when no specific forms */}
            {showOrderForms && orderForms.length === 0 && (
              <a href={`/book/${workspaceSlug}`}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors" style={{ backgroundColor: `${brandColor}15` }}>
                  <ClipboardList className="w-4 h-4" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">I need to place an order</p>
                  <p className="text-xs text-gray-500 mt-0.5">Go to the order form.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-blue-400 transition-colors" />
              </a>
            )}
          </div>
        </>
      )}

      {/* ── SIGN IN VIEW ── */}
      {view === "signin" && (
        <>
          <button onClick={() => { setView("options"); setError(null); }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in</h1>
          <p className="text-sm text-gray-500 mb-8">Enter your email and password to access your portal.</p>
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
            </div>
          )}
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" required autoFocus className={inputClass} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-colors" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading || !email.trim() || !password}
              className="w-full flex items-center justify-center gap-2 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              style={{ backgroundColor: brandColor }}>
              {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <>Sign in <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
          <p className="mt-3 text-xs text-center text-gray-400">
            <button onClick={() => { setView("forgot"); setForgotEmail(email); setError(null); }} className="hover:underline font-medium" style={{ color: brandColor }}>Forgot password?</button>
          </p>
          <p className="mt-3 text-xs text-center text-gray-400">
            Don&apos;t have an account?{" "}
            <button onClick={() => { setView("no-account"); setError(null); }} className="hover:underline font-medium" style={{ color: brandColor }}>Create one</button>
          </p>
        </>
      )}

      {/* ── FORGOT PASSWORD VIEW ── */}
      {view === "forgot" && (
        <>
          <button onClick={() => { setView("signin"); setError(null); }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to sign in
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset your password</h1>
          <p className="text-sm text-gray-500 mb-8">Enter your email and we&apos;ll take you to a page to set a new password.</p>
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
            </div>
          )}
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com" required autoFocus className={inputClass} />
              </div>
            </div>
            <button type="submit" disabled={loading || !forgotEmail.trim()}
              className="w-full flex items-center justify-center gap-2 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              style={{ backgroundColor: brandColor }}>
              {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </>
      )}

      {/* ── SIGN UP VIEW ── */}
      {view === "no-account" && (
        <>
          <button onClick={() => { setView("options"); setError(null); }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create an account</h1>
          <p className="text-sm text-gray-500 mb-7">Fill in your details to set up your client portal.</p>
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
            </div>
          )}
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">First name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={reqFirstName} onChange={(e) => setReqFirstName(e.target.value)}
                    placeholder="Jane" required className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-colors" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Last name</label>
                <input type="text" value={reqLastName} onChange={(e) => setReqLastName(e.target.value)}
                  placeholder="Smith" required className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-colors" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={reqEmail} onChange={(e) => setReqEmail(e.target.value)}
                  placeholder="you@example.com" required className={inputClass} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="tel" value={reqPhone} onChange={(e) => setReqPhone(e.target.value)}
                  placeholder="(555) 000-0000" className={inputClass} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Brokerage / team <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" value={reqCompany} onChange={(e) => setReqCompany(e.target.value)}
                placeholder="e.g. RE/MAX Downtown" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showReqPassword ? "text" : "password"} value={reqPassword}
                  onChange={(e) => setReqPassword(e.target.value)} placeholder="Min. 6 characters"
                  required minLength={6} className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-colors" />
                <button type="button" onClick={() => setShowReqPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showReqPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showReqPassword ? "text" : "password"} value={reqPasswordConfirm}
                  onChange={(e) => setReqPasswordConfirm(e.target.value)} placeholder="Re-enter password"
                  required className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-colors" />
              </div>
            </div>
            <button type="submit" disabled={loading || !reqFirstName.trim() || !reqLastName.trim() || !reqEmail.trim() || !reqPassword}
              className="w-full flex items-center justify-center gap-2 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              style={{ backgroundColor: brandColor }}>
              {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
          <p className="mt-5 text-xs text-center text-gray-400">
            Already have an account?{" "}
            <button onClick={() => { setView("signin"); setError(null); }} className="hover:underline font-medium" style={{ color: brandColor }}>Sign in instead</button>
          </p>
        </>
      )}
    </div>
  );

  // ── Right panel (hero) ────────────────────────────────────────────────────
  const heroPanel = (
    <div
      className="hidden lg:flex flex-1 flex-col items-center justify-center px-12 relative overflow-hidden"
      style={{
        backgroundColor: heroImage ? undefined : `${brandColor}12`,
        backgroundImage: heroImage ? `url(${heroImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay for readability */}
      {heroImage && <div className="absolute inset-0 bg-black/50" />}
      {!heroImage && (
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: brandColor }} />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" style={{ backgroundColor: brandColor }} />
        </div>
      )}
      <div className="relative text-center max-w-sm">
        {ws?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ws.logoUrl} alt={workspaceName} className="h-14 w-auto mx-auto mb-6 object-contain" />
        ) : (
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border text-white text-2xl font-bold"
            style={{ backgroundColor: `${brandColor}33`, borderColor: `${brandColor}44` }}>
            {workspaceName[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <h2 className={`text-2xl font-bold mb-3 ${heroImage ? "text-white" : "text-gray-900"}`}>
          Your {workspaceName}
        </h2>
        <p className={`text-sm leading-relaxed mb-8 ${heroImage ? "text-white/70" : "text-gray-500"}`}>
          View your orders, access delivered photos, pay invoices, and book new shoots — all in one place.
        </p>
        <div className="space-y-3 text-left">
          {bullets.map((item) => (
            <div key={item} className={`flex items-center gap-3 text-sm ${heroImage ? "text-white/80" : "text-gray-600"}`}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandColor}33` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandColor }} />
              </div>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Layout rendering ──────────────────────────────────────────────────────
  if (layout === "centered") {
    return (
      <div className="min-h-screen relative flex items-center justify-center"
        style={{
          backgroundImage: heroImage ? `url(${heroImage})` : undefined,
          backgroundSize: "cover", backgroundPosition: "center",
          backgroundColor: heroImage ? undefined : "#f9fafb",
        }}>
        {heroImage && <div className="absolute inset-0 bg-black/40" />}
        <div className="relative bg-white rounded-2xl shadow-2xl p-8 sm:p-10 mx-4 max-w-md w-full">
          {formContent}
        </div>
      </div>
    );
  }

  if (layout === "fullHero") {
    return (
      <div className="min-h-screen relative"
        style={{
          backgroundImage: heroImage ? `url(${heroImage})` : undefined,
          backgroundSize: "cover", backgroundPosition: "center",
          backgroundColor: heroImage ? undefined : `${brandColor}08`,
        }}>
        {heroImage && <div className="absolute inset-0 bg-black/50" />}
        <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 sm:p-10 max-w-md w-full">
            {formContent}
          </div>
        </div>
      </div>
    );
  }

  // Default: split layout
  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 bg-white">
        {formContent}
      </div>
      {heroPanel}
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

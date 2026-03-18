"use client";

import { useState } from "react";
import { CheckCircle, Loader2, CreditCard, Zap, Building2, ExternalLink, Clock, AlertTriangle } from "lucide-react";

interface WorkspaceInfo {
  id: string;
  name: string;
  subscriptionStatus: string;
  subscriptionTier: string | null;
  trialDaysLeft: number | null;
  graceDaysLeft: number | null;
  hasStripeCustomer: boolean;
}

interface Plan {
  id: "STARTER" | "PRO" | "AGENCY";
  name: string;
  price: number;
  icon: React.ReactNode;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "STARTER",
    name: "Starter",
    price: 39,
    icon: <Zap className="w-5 h-5" />,
    tagline: "Perfect for solo photographers",
    features: [
      "1 photographer account",
      "Up to 50 jobs / month",
      "Client portal & invoicing",
      "Gallery delivery",
      "Mobile PWA app",
      "Email notifications",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 79,
    icon: <CreditCard className="w-5 h-5" />,
    tagline: "Growing photography businesses",
    features: [
      "Up to 5 photographer accounts",
      "Unlimited jobs",
      "Online invoice payments (Stripe)",
      "Booking page for clients",
      "Brokerage group discounts",
      "Priority email support",
    ],
    highlight: true,
  },
  {
    id: "AGENCY",
    name: "Agency",
    price: 149,
    icon: <Building2 className="w-5 h-5" />,
    tagline: "Multi-photographer studios",
    features: [
      "Unlimited photographer accounts",
      "Unlimited jobs",
      "Everything in Pro",
      "Custom brand colors & logo",
      "Service territories",
      "Dedicated support",
    ],
  },
];

interface Props {
  workspace: WorkspaceInfo;
  justSubscribed: boolean;
}

export function BillingClient({ workspace, justSubscribed }: Props) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");

  const isActive = workspace.subscriptionStatus === "ACTIVE";
  const isTrialing = workspace.subscriptionStatus === "TRIALING";
  const isGrace = workspace.subscriptionStatus === "GRACE_PERIOD";
  const isPastDue = workspace.subscriptionStatus === "PAST_DUE";
  const isCanceled = workspace.subscriptionStatus === "CANCELED";

  async function handleSubscribe(plan: Plan) {
    setLoadingPlan(plan.id);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: plan.id }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout");
      window.location.href = data.url!;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoadingPlan(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to open portal");
      window.location.href = data.url!;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPortalLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Success banner */}
      {justSubscribed && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">You&apos;re subscribed — welcome to Scalist!</p>
            <p className="text-xs text-green-600 mt-0.5">Your account is now fully active.</p>
          </div>
        </div>
      )}

      {/* Trial banner */}
      {isTrialing && workspace.trialDaysLeft !== null && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
          <Clock className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">
              {workspace.trialDaysLeft > 0
                ? `${workspace.trialDaysLeft} day${workspace.trialDaysLeft === 1 ? "" : "s"} left in your trial`
                : "Your trial ends today"}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              Subscribe below to keep access after your trial ends. You won&apos;t be charged until your trial is over.
            </p>
          </div>
        </div>
      )}

      {/* Grace period warning */}
      {isGrace && workspace.graceDaysLeft !== null && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {workspace.graceDaysLeft > 0
                ? `${workspace.graceDaysLeft} day${workspace.graceDaysLeft === 1 ? "" : "s"} until your account is locked`
                : "Your account will be locked today"}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Subscribe now to keep all your data and avoid losing access.
            </p>
          </div>
        </div>
      )}

      {/* Past due warning */}
      {isPastDue && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm font-semibold text-red-800">
            Your last payment failed. Please update your payment method to keep your account active.
          </p>
        </div>
      )}

      {/* Active subscription */}
      {isActive && workspace.subscriptionTier && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {PLANS.find((p) => p.id === workspace.subscriptionTier)?.name ?? workspace.subscriptionTier} Plan
              </p>
              <p className="text-sm text-gray-500">Active subscription · renews monthly</p>
            </div>
          </div>
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Manage Subscription
          </button>
        </div>
      )}

      {/* Plan cards */}
      {(!isActive || isCanceled || isGrace) && (
        <>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isActive ? "Change Plan" : "Choose a Plan"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">All plans include a 14-day free trial. Cancel anytime.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map((plan) => {
              const isCurrent = isActive && workspace.subscriptionTier === plan.id;
              const isLoading = loadingPlan === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl border-2 p-6 flex flex-col transition-shadow ${
                    plan.highlight
                      ? "border-blue-500 shadow-lg shadow-blue-50"
                      : "border-gray-100"
                  }`}
                >
                  {plan.highlight && (
                    <span className="inline-flex self-start text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full mb-3">
                      Most Popular
                    </span>
                  )}

                  <div className="flex items-center gap-2.5 mb-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      plan.highlight ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                    }`}>
                      {plan.icon}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{plan.name}</p>
                      <p className="text-xs text-gray-500">{plan.tagline}</p>
                    </div>
                  </div>

                  <div className="mb-5">
                    <span className="text-3xl font-extrabold text-gray-900">${plan.price}</span>
                    <span className="text-sm text-gray-400 ml-1">/ month</span>
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="w-full text-center py-2.5 rounded-xl text-sm font-semibold text-green-700 bg-green-50">
                      Current Plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan)}
                      disabled={!!loadingPlan}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60 ${
                        plan.highlight
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-900 text-white hover:bg-gray-800"
                      }`}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Redirecting…
                        </span>
                      ) : (
                        `Subscribe — $${plan.price}/mo`
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Manage button for active subscribers who want to change/cancel */}
      {isActive && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Need to change or cancel?</h3>
          <p className="text-sm text-gray-500 mb-4">
            Use the Stripe billing portal to update your payment method, switch plans, or cancel your subscription.
          </p>
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-60"
          >
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Open Billing Portal
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}

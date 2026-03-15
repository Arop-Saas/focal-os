"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import {
  CreditCard,
  Calendar,
  Mail,
  Link2,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Zap,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationStatus = "connected" | "not_connected" | "coming_soon";

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: IntegrationStatus }) {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Connected
      </span>
    );
  }
  if (status === "coming_soon") {
    return (
      <span className="text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">
        Coming Soon
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
      Not Connected
    </span>
  );
}

// ─── Integration Card ─────────────────────────────────────────────────────────

function IntegrationCard({
  logo,
  name,
  description,
  status,
  children,
  docsUrl,
}: {
  logo: React.ReactNode;
  name: string;
  description: string;
  status: IntegrationStatus;
  children?: React.ReactNode;
  docsUrl?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = status !== "coming_soon" && !!children;

  return (
    <div
      className={cn(
        "bg-white rounded-xl border transition-all",
        status === "connected" ? "border-green-200 shadow-sm" : "border-gray-200",
        canExpand && "cursor-pointer"
      )}
    >
      {/* Card header */}
      <div
        className={cn("flex items-center gap-4 p-5", canExpand && "select-none")}
        onClick={() => canExpand && setExpanded((v) => !v)}
      >
        {/* Logo */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
          {logo}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm">{name}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={status} />
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Documentation"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {canExpand && (
            expanded
              ? <ChevronUp className="h-4 w-4 text-gray-400" />
              : <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {canExpand && expanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Stripe Config Form ───────────────────────────────────────────────────────

function StripeConfig({
  initialPublishableKey,
  hasSecretKey,
  onSaved,
  onDisconnected,
}: {
  initialPublishableKey: string | null;
  hasSecretKey: boolean;
  onSaved: () => void;
  onDisconnected: () => void;
}) {
  const isConnected = !!(initialPublishableKey && hasSecretKey);
  const [editing, setEditing] = useState(!isConnected);
  const [pk, setPk] = useState(initialPublishableKey ?? "");
  const [sk, setSk] = useState("");
  const [whSecret, setWhSecret] = useState("");
  const [error, setError] = useState("");

  const saveMutation = api.workspace.saveStripeKeys.useMutation({
    onSuccess: () => {
      setError("");
      setSk("");
      setEditing(false);
      onSaved();
    },
    onError: (e) => setError(e.message),
  });

  const disconnectMutation = api.workspace.disconnectStripe.useMutation({
    onSuccess: () => {
      setPk("");
      setSk("");
      setWhSecret("");
      setEditing(true);
      onDisconnected();
    },
  });

  if (isConnected && !editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
          <Check className="h-4 w-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">Stripe is connected</p>
            <p className="text-xs text-green-600 mt-0.5 font-mono truncate">{initialPublishableKey}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Edit keys
          </button>
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            {disconnectMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-2">
        <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Enter your Stripe API keys to accept invoice payments. Find these in your{" "}
          <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline font-medium">
            Stripe Dashboard → API keys
          </a>.
          Use test keys (<span className="font-mono">pk_test_…</span>) while developing.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Publishable Key</label>
          <input
            value={pk}
            onChange={(e) => setPk(e.target.value)}
            placeholder="pk_test_..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Secret Key {isConnected && <span className="text-gray-400 font-normal">(leave blank to keep existing)</span>}
          </label>
          <input
            value={sk}
            onChange={(e) => setSk(e.target.value)}
            type="password"
            placeholder={isConnected ? "••••••••••••••••" : "sk_test_..."}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Webhook Secret <span className="text-gray-400 font-normal">(optional — for payment confirmations)</span>
          </label>
          <input
            value={whSecret}
            onChange={(e) => setWhSecret(e.target.value)}
            type="password"
            placeholder="whsec_..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!pk.startsWith("pk_")) return setError("Publishable key must start with pk_");
            if (!isConnected && !sk) return setError("Secret key is required.");
            if (sk && !sk.startsWith("sk_")) return setError("Secret key must start with sk_");
            setError("");
            saveMutation.mutate({
              publishableKey: pk,
              secretKey: sk || undefined,  // blank = keep existing on server
              webhookSecret: whSecret || undefined,
            });
          }}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
        >
          {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save keys
        </button>
        {isConnected && (
          <button
            onClick={() => setEditing(false)}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IntegrationsTab() {
  const { data, refetch } = api.workspace.getIntegrations.useQuery();

  const stripeConnected = !!(data?.stripe.connected);
  const gcalConnected = !!(data?.googleCalendar.connected);

  return (
    <div className="space-y-8">

      {/* Payments */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gray-400" />
            Payments
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Enable accepting payment for invoices.</p>
        </div>
        <div className="space-y-3">
          <IntegrationCard
            logo={
              <svg viewBox="0 0 60 25" className="w-16 h-auto px-1" fill="none">
                <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a12.08 12.08 0 0 1-4.56.83c-4.17 0-6.67-2.69-6.67-7.01 0-3.93 2.27-7.02 6.14-7.02 3.9 0 5.9 3.1 5.9 6.96v1.32zm-5.9-4.27c-1.18 0-2.44.83-2.44 2.81h4.8c0-1.98-1.19-2.81-2.36-2.81zm-11.69 9.29a5.6 5.6 0 0 1-2.26.46c-2.32 0-3.85-1.58-3.85-4.38v-5.1H34.5V6.94h1.44V4.15l4.02-1.18v3.97h2.39v3.34h-2.39v4.86c0 1.16.52 1.64 1.37 1.64.36 0 .77-.06 1.15-.22v3.34h-.03zm-16.4-.46V6.94h4.02v12.9h-4.02zm0-14.68V0h4.02v4.16h-4.02zm-6.53 14.68H15.1V6.94h3.88v1.96c.78-1.37 1.96-2.25 3.71-2.25.18 0 .41.01.52.03v3.8c-.16-.03-.43-.06-.72-.06-1.88 0-3.07.93-3.38 2.96v6.52z" fill="#635BFF"/>
              </svg>
            }
            name="Stripe"
            description="Accept credit card and ACH payments for invoices. Clients pay directly via a secure payment link."
            status={stripeConnected ? "connected" : "not_connected"}
            docsUrl="https://stripe.com/docs/keys"
          >
            <StripeConfig
              initialPublishableKey={data?.stripe.publishableKey ?? null}
              hasSecretKey={data?.stripe.hasSecretKey ?? false}
              onSaved={() => refetch()}
              onDisconnected={() => refetch()}
            />
          </IntegrationCard>

          <IntegrationCard
            logo={
              <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">SQ</span>
              </div>
            }
            name="Square"
            description="Accept payments through Square's payment processing network."
            status="coming_soon"
          />
        </div>
      </section>

      {/* Calendar */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            Calendar
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Sync appointments and block availability in real time.</p>
        </div>
        <div className="space-y-3">
          <IntegrationCard
            logo={
              <svg viewBox="0 0 24 24" className="w-7 h-7">
                <path d="M19.5 3h-3V1.5h-1.5V3h-6V1.5H7.5V3h-3C3.675 3 3 3.675 3 4.5v15C3 20.325 3.675 21 4.5 21h15c.825 0 1.5-.675 1.5-1.5v-15C21 3.675 20.325 3 19.5 3zm0 16.5h-15V9h15v10.5zm0-12h-15V4.5h3V6H9V4.5h6V6h1.5V4.5h3V7.5z" fill="#4285F4"/>
                <path d="M7 11h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zM7 15h2v2H7zm4 0h2v2h-2z" fill="#34A853"/>
              </svg>
            }
            name="Google Calendar"
            description="Sync jobs to Google Calendar for real-time availability and scheduling. Connect per team member in Staff settings."
            status={gcalConnected ? "connected" : "not_connected"}
          >
            <div className="space-y-3">
              {gcalConnected ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Connected</p>
                    {data?.googleCalendar.email && (
                      <p className="text-xs text-green-600">{data.googleCalendar.email}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Google Calendar sync is configured per team member. Ask each photographer to connect their Google Calendar from the Staff page or their profile settings.
                  </p>
                </div>
              )}
            </div>
          </IntegrationCard>

          <IntegrationCard
            logo={
              <div className="w-8 h-8 bg-[#0078D4] rounded flex items-center justify-center">
                <span className="text-white font-bold text-[10px]">OL</span>
              </div>
            }
            name="Outlook Calendar"
            description="Sync jobs with Microsoft Outlook and Office 365 calendars."
            status="coming_soon"
          />

          <IntegrationCard
            logo={
              <div className="w-8 h-8 bg-white rounded border flex items-center justify-center text-lg">📅</div>
            }
            name="Other Calendars"
            description="Sync via iCal (.ics) feed — works with Apple Calendar, Fantastical, and any calendar that supports iCal subscriptions."
            status="coming_soon"
          />
        </div>
      </section>

      {/* Communications */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-400" />
            Communications
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Email delivery for booking confirmations, invoices, and receipts.</p>
        </div>
        <div className="space-y-3">
          <IntegrationCard
            logo={
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                <span className="text-white font-bold text-xs">R</span>
              </div>
            }
            name="Resend"
            description="Transactional email for booking confirmations, invoice delivery, and payment receipts. Active and sending from your workspace."
            status="connected"
            docsUrl="https://resend.com/docs"
          >
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
              <Check className="h-4 w-4 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Resend is active</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Currently sending from <span className="font-medium">onboarding@resend.dev</span>.
                  Add a custom domain in your{" "}
                  <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline">
                    Resend dashboard
                  </a>{" "}
                  to send from your own address.
                </p>
              </div>
            </div>
          </IntegrationCard>
        </div>
      </section>

      {/* Automation */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="h-4 w-4 text-gray-400" />
            Automation
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Connect FocalOS to thousands of other tools.</p>
        </div>
        <div className="space-y-3">
          <IntegrationCard
            logo={
              <div className="w-8 h-8 bg-[#FF4A00] rounded flex items-center justify-center">
                <Zap className="h-4 w-4 text-white fill-white" />
              </div>
            }
            name="Zapier"
            description="Automate workflows between FocalOS and 6,000+ apps. Trigger zaps on new jobs, paid invoices, and more."
            status="coming_soon"
          />
          <IntegrationCard
            logo={
              <div className="w-8 h-8 bg-[#7C3AED] rounded flex items-center justify-center">
                <Link2 className="h-4 w-4 text-white" />
              </div>
            }
            name="Webhooks"
            description="Send real-time event payloads to your own endpoint on any workspace event."
            status="coming_soon"
          />
        </div>
      </section>
    </div>
  );
}

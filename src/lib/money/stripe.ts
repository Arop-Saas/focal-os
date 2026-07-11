/**
 * core/money — Stripe access for client payments.
 *
 * Preferred: Stripe CONNECT (Standard). The platform key signs every request
 * and `stripeAccount` scopes it to the studio's connected account, so ONE
 * platform webhook (with ONE secret) verifies events for every workspace —
 * this kills risk R1 (per-workspace pasted keys could never verify webhooks).
 *
 * Legacy: workspaces that pasted their own secret key keep working for
 * checkout, but their webhooks can't confirm payment automatically. The
 * Integrations page nudges them to connect properly.
 */
import Stripe from "stripe";

export const API_VERSION = "2024-06-20" as const;

export const platformStripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: API_VERSION,
  typescript: true,
});

export interface WorkspaceStripeRef {
  stripeAccountId?: string | null;
  stripeSecretKey?: string | null;
}

export type StripeMode = "connect" | "legacy_key" | "none";

export function stripeModeFor(ws: WorkspaceStripeRef): StripeMode {
  if (ws.stripeAccountId) return "connect";
  if (ws.stripeSecretKey) return "legacy_key";
  return "none";
}

/** Client + per-request options for acting AS the workspace. */
export function stripeFor(ws: WorkspaceStripeRef): {
  stripe: Stripe;
  requestOptions: Stripe.RequestOptions | undefined;
  mode: StripeMode;
} {
  const mode = stripeModeFor(ws);
  if (mode === "connect") {
    return {
      stripe: platformStripe,
      requestOptions: { stripeAccount: ws.stripeAccountId! },
      mode,
    };
  }
  if (mode === "legacy_key") {
    return {
      stripe: new Stripe(ws.stripeSecretKey!, { apiVersion: API_VERSION }),
      requestOptions: undefined,
      mode,
    };
  }
  return { stripe: platformStripe, requestOptions: undefined, mode };
}

/** Lowercase ISO currency for Stripe (workspace.currency is e.g. "CAD"). */
export function stripeCurrency(workspaceCurrency: string | null | undefined): string {
  return (workspaceCurrency || "USD").toLowerCase();
}

/**
 * Environment variable validation.
 * Import this in server-only code (e.g. tRPC context, API routes).
 * Throws clearly at startup if a required variable is missing.
 */

// Only vars that are truly required to boot — checked at runtime, not build time.
// Stripe price IDs are optional at boot (only needed when a user subscribes).
const REQUIRED_VARS = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "NEXT_PUBLIC_APP_URL",
] as const;

if (typeof window === "undefined") {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  • ${k}`).join("\n")}\n\nCopy .env.example to .env.local and fill in the values.`
    );
  }
}

export const env = {
  databaseUrl:              process.env.DATABASE_URL!,
  supabaseUrl:              process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey:          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey:   process.env.SUPABASE_SERVICE_ROLE_KEY!,
  stripeSecretKey:          process.env.STRIPE_SECRET_KEY!,
  stripeWebhookSecret:      process.env.STRIPE_WEBHOOK_SECRET!,
  stripePriceStarter:       process.env.STRIPE_PRICE_STARTER!,
  stripePricePro:           process.env.STRIPE_PRICE_PRO!,
  stripePriceAgency:        process.env.STRIPE_PRICE_AGENCY!,
  resendApiKey:             process.env.RESEND_API_KEY!,
  emailFrom:                process.env.EMAIL_FROM!,
  appUrl:                   process.env.NEXT_PUBLIC_APP_URL!,
  portalTokenSecret:        process.env.PORTAL_TOKEN_SECRET ?? process.env.CRON_SECRET ?? "",
  cronSecret:               process.env.CRON_SECRET ?? "",
  googleMapsApiKey:         process.env.GOOGLE_MAPS_API_KEY ?? "",   // Legacy — kept for Google Calendar OAuth
  mapboxAccessToken:        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "",
} as const;

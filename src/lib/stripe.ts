import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
  typescript: true,
});

// Single source of truth for plan definitions.
// Prices shown here MUST match what's configured in Stripe dashboard.
// Env vars: STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_AGENCY
export const PLANS = {
  STARTER: {
    name: "Starter",
    description: "Perfect for solo photographers",
    price: 39,
    priceId: process.env.STRIPE_PRICE_STARTER!,
    features: [
      "1 photographer account",
      "Up to 50 jobs / month",
      "Client portal & invoicing",
      "Gallery delivery",
      "Mobile PWA app",
      "Email notifications",
    ],
    limits: { jobs: 50, staff: 1, storageGb: 5 },
  },
  PRO: {
    name: "Pro",
    description: "Growing photography businesses",
    price: 79,
    priceId: process.env.STRIPE_PRICE_PRO!,
    features: [
      "Up to 5 photographer accounts",
      "Unlimited jobs",
      "Online invoice payments (Stripe)",
      "Booking page for clients",
      "Brokerage group discounts",
      "Priority email support",
    ],
    limits: { jobs: -1, staff: 5, storageGb: 50 },
  },
  AGENCY: {
    name: "Agency",
    description: "Multi-photographer studios",
    price: 149,
    priceId: process.env.STRIPE_PRICE_AGENCY!,
    features: [
      "Unlimited photographer accounts",
      "Unlimited jobs",
      "Everything in Pro",
      "Custom brand colors & logo",
      "Service territories",
      "Dedicated support",
    ],
    limits: { jobs: -1, staff: -1, storageGb: 500 },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

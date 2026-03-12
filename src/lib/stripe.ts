import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
  typescript: true,
});

export const PLANS = {
  STARTER: {
    name: "Starter",
    description: "For solo photographers",
    price: 49,
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
    features: [
      "Up to 50 jobs/month",
      "1 photographer",
      "5GB storage",
      "Basic invoicing",
      "Email notifications",
    ],
    limits: { jobs: 50, staff: 1, storageGb: 5 },
  },
  PRO: {
    name: "Pro",
    description: "For growing teams",
    price: 149,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    features: [
      "Unlimited jobs",
      "Up to 10 photographers",
      "50GB storage",
      "Full invoicing & payments",
      "SMS + Email notifications",
      "Gallery delivery",
      "Scheduling with travel time",
      "Reporting dashboard",
    ],
    limits: { jobs: -1, staff: 10, storageGb: 50 },
  },
  ENTERPRISE: {
    name: "Enterprise",
    description: "For large operations",
    price: 399,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    features: [
      "Everything in Pro",
      "Unlimited photographers",
      "500GB storage",
      "White-label branding",
      "Multi-location support",
      "API access",
      "Priority support",
      "Custom integrations",
    ],
    limits: { jobs: -1, staff: -1, storageGb: 500 },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

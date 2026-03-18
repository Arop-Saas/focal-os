import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { BillingClient } from "./BillingClient";
import { differenceInDays } from "date-fns";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string }>;
}) {
  const { subscribed } = await searchParams;
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: {
      workspaces: {
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              subscriptionStatus: true,
              subscriptionTier: true,
              subscriptionEndsAt: true,
              trialEndsAt: true,
              gracePeriodEndsAt: true,
              stripeCustomerId: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  const workspace = user?.workspaces[0]?.workspace;
  if (!workspace) return null;

  const now = new Date();
  const trialDaysLeft = workspace.trialEndsAt
    ? Math.max(0, differenceInDays(workspace.trialEndsAt, now))
    : null;
  const graceDaysLeft = workspace.gracePeriodEndsAt
    ? Math.max(0, differenceInDays(workspace.gracePeriodEndsAt, now))
    : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Billing" description="Manage your Scalist subscription" />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <BillingClient
          workspace={{
            id: workspace.id,
            name: workspace.name,
            subscriptionStatus: workspace.subscriptionStatus,
            subscriptionTier: workspace.subscriptionTier,
            trialDaysLeft,
            graceDaysLeft,
            hasStripeCustomer: !!workspace.stripeCustomerId,
          }}
          justSubscribed={subscribed === "1"}
        />
      </div>
    </div>
  );
}

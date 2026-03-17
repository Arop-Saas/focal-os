import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SubscriptionExpiredBanner } from "@/components/billing/SubscriptionExpiredBanner";

// Routes inside the dashboard that should always be accessible
// even when the subscription has lapsed (so users can re-subscribe)
const BILLING_EXEMPT_PATHS = ["/billing", "/settings"];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    include: {
      workspaces: {
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              subscriptionStatus: true,
              trialEndsAt: true,
              gracePeriodEndsAt: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
        take: 1,
      },
    },
  });

  if (!user) {
    redirect("/onboarding");
  }

  // No workspace = needs onboarding
  if (!user.workspaces.length || !user.onboardingCompleted) {
    redirect("/onboarding");
  }

  const workspace = user.workspaces[0].workspace;

  // ── Subscription guard ────────────────────────────────────────────────────
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isExempt = BILLING_EXEMPT_PATHS.some((p) => pathname.startsWith(p));

  const now = new Date();
  const status = workspace.subscriptionStatus;

  // Hard lock: trial expired with no grace, or grace period also expired
  const trialExpired =
    status === "TRIALING" &&
    workspace.trialEndsAt !== null &&
    workspace.trialEndsAt < now;

  const graceExpired =
    status === "GRACE_PERIOD" &&
    workspace.gracePeriodEndsAt !== null &&
    workspace.gracePeriodEndsAt < now;

  const isLocked = (trialExpired || graceExpired || status === "CANCELED") && !isExempt;

  if (isLocked) {
    redirect("/billing");
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Days left in trial (for soft warning banner in the shell)
  const trialDaysLeft =
    status === "TRIALING" && workspace.trialEndsAt
      ? Math.max(0, Math.ceil((workspace.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

  const graceDaysLeft =
    status === "GRACE_PERIOD" && workspace.gracePeriodEndsAt
      ? Math.max(0, Math.ceil((workspace.gracePeriodEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

  return (
    <DashboardShell
      workspaceName={workspace.name}
      userEmail={user.email}
      isSuperAdmin={user.isSuperAdmin}
    >
      {/* Trial / grace period soft banner at the top of every page */}
      {(trialDaysLeft !== null || graceDaysLeft !== null) && (
        <SubscriptionExpiredBanner
          trialDaysLeft={trialDaysLeft}
          graceDaysLeft={graceDaysLeft}
        />
      )}
      {children}
    </DashboardShell>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";

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
        include: { workspace: true },
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

  return (
    <DashboardShell
      workspaceName={workspace.name}
      userEmail={user.email}
      isSuperAdmin={user.isSuperAdmin}
    >
      {children}
    </DashboardShell>
  );
}

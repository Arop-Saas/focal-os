import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";

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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        workspaceName={workspace.name}
        userEmail={user.email}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}

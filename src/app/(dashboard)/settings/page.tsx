import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { SettingsTabs } from "@/components/settings/settings-tabs";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });

  const workspace = user!.workspaces[0].workspace;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Settings" description="Manage workspace settings and preferences" />

      <div className="flex-1 overflow-y-auto">
        <SettingsTabs workspace={workspace} />
      </div>
    </div>
  );
}

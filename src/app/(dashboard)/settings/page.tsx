import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { Header } from "@/components/layout/header";
import { SettingsTabs } from "@/components/settings/settings-tabs";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const workspaceId = await resolveWorkspaceId(supabaseUser!.id);
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Settings" description="Manage workspace settings and preferences" />

      <div className="flex-1 overflow-hidden bg-gray-50">
        <SettingsTabs workspace={workspace} />
      </div>
    </div>
  );
}

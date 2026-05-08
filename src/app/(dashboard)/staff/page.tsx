import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { Header } from "@/components/layout/header";
import { TeamTable } from "@/components/staff/staff-table";
import { AddTeamMemberButton } from "@/components/staff/add-team-member-button";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  await resolveWorkspaceId(supabaseUser!.id);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Team"
        description="Manage your team members"
        actions={<AddTeamMemberButton />}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <TeamTable />
      </div>
    </div>
  );
}

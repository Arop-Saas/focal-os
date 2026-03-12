import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { StaffTable } from "@/components/staff/staff-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });

  const workspaceId = user!.workspaces[0].workspace.id;

  // Fetch stats
  const [totalMembers, activePhotographers, activeEditors] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId } }),
    prisma.workspaceMember.count({ where: { workspaceId, role: "PHOTOGRAPHER", staffProfile: { isActive: true } } }),
    prisma.workspaceMember.count({ where: { workspaceId, role: "EDITOR", staffProfile: { isActive: true } } }),
  ]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Staff"
        description={`${totalMembers} team members`}
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Invite Member
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Members</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalMembers}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active Photographers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{activePhotographers}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active Editors</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{activeEditors}</p>
          </div>
        </div>

        {/* Staff Table */}
        <StaffTable />
      </div>
    </div>
  );
}

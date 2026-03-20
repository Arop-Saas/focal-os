import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { Header } from "@/components/layout/header";
import { TerritoriesManager } from "@/components/territories/territories-manager";

export const metadata = { title: "Territories" };
export const dynamic = "force-dynamic";

export default async function TerritoriesPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const workspaceId = await resolveWorkspaceId(supabaseUser!.id);

  const territories = await prisma.serviceTerritory.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Territories of Service"
        description="Define the geographic areas your studio serves"
      />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <TerritoriesManager initialTerritories={territories} />
      </div>
    </div>
  );
}

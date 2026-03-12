import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { PackagesView } from "@/components/packages/packages-view";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: "Packages" };

export default async function PackagesPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Packages & Services"
        description="Manage your service offerings and package bundles"
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <PackagesView />
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { NewJobForm } from "@/components/jobs/new-job-form";

export const metadata = { title: "New Job" };

export default async function NewJobPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });

  const workspaceId = user!.workspaces[0].workspace.id;

  const [clients, packages, services, staff] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, email: true, company: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.package.findMany({
      where: { workspaceId, isActive: true },
      include: { items: { include: { service: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.service.findMany({
      where: { workspaceId, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.staffProfile.findMany({
      where: { workspaceId, isActive: true },
      include: { member: { include: { user: { select: { id: true, fullName: true } } } } },
      orderBy: { member: { user: { fullName: "asc" } } },
    }),
  ]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="New Job" description="Schedule a new photography shoot" />
      <div className="flex-1 overflow-y-auto p-6">
        <NewJobForm
          clients={clients}
          packages={packages}
          services={services}
          staff={staff}
        />
      </div>
    </div>
  );
}

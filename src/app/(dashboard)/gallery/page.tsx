import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { GalleriesGrid } from "@/components/gallery/galleries-grid";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: "Gallery" };

export default async function GalleryPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });

  const workspaceId = user!.workspaces[0].workspace.id;

  const galleries = await prisma.gallery.findMany({
    where: { workspaceId },
    include: {
      job: {
        include: {
          client: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const galleriesWithDetails = galleries.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    status: g.status,
    clientName: `${g.job.client.firstName} ${g.job.client.lastName}`,
    jobAddress: g.job.propertyAddress,
    photoCount: g.mediaCount,
    expiresAt: g.expiresAt,
    createdAt: g.createdAt,
  }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Gallery"
        description={`${galleries.length} total galleries`}
        actions={
          <Button size="sm" disabled className="opacity-50 cursor-not-allowed">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Gallery
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <GalleriesGrid galleries={galleriesWithDetails} />
      </div>
    </div>
  );
}

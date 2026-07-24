import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";

export const dynamic = "force-dynamic";

/**
 * Clicking a listing opens the showcase — the same delivery page the
 * customer sees (/g/[slug]). Listings that aren't customer-visible yet
 * (draft/private) land on their order's Files & Delivery tab, where the
 * listing is managed.
 */
export default async function ListingShowcasePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  const workspaceId = await resolveWorkspaceId(supabaseUser!.id);

  const gallery = await prisma.gallery.findFirst({
    where: { id: params.id, workspaceId },
    select: { slug: true, isPublic: true, status: true, jobId: true },
  });
  if (!gallery) notFound();

  const showcaseReady =
    gallery.isPublic && gallery.status !== "ARCHIVED" && gallery.status !== "EXPIRED";

  redirect(showcaseReady ? `/g/${gallery.slug}` : `/jobs/${gallery.jobId}?tab=files`);
}

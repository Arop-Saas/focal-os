import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

/**
 * Returns the effective workspace ID for a given Supabase user.
 *
 * If the user is a super-admin and has an active `admin_impersonating` cookie,
 * the impersonated workspace ID is returned so all page data reflects
 * the target workspace rather than the admin's own.
 */
export async function resolveWorkspaceId(supabaseUserId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUserId },
    select: {
      isSuperAdmin: true,
      workspaces: {
        select: { workspaceId: true },
        orderBy: { joinedAt: "asc" },
        take: 1,
      },
    },
  });

  if (!user?.workspaces.length) {
    throw new Error("No workspace found for user");
  }

  if (user.isSuperAdmin) {
    const cookieStore = await cookies();
    const impersonatingId = cookieStore.get("admin_impersonating")?.value ?? null;
    if (impersonatingId) {
      const ws = await prisma.workspace.findUnique({
        where: { id: impersonatingId },
        select: { id: true },
      });
      if (ws) return ws.id;
    }
  }

  return user.workspaces[0].workspaceId;
}

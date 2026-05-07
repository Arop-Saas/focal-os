import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPortalToken, PORTAL_COOKIE, type PortalSession } from "./portal-auth";
import prisma from "./prisma";
import type { Client, Workspace } from "@prisma/client";

export async function getPortalSession(
  workspaceSlug: string
): Promise<{ session: PortalSession; client: Client; workspace: Workspace } | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(PORTAL_COOKIE)?.value;
  if (!token) return null;

  const session = verifyPortalToken(token);
  if (!session || session.workspaceSlug !== workspaceSlug) return null;

  const [client, workspace] = await Promise.all([
    prisma.client.findUnique({ where: { id: session.clientId } }),
    prisma.workspace.findUnique({ where: { slug: workspaceSlug } }),
  ]);

  if (!client || !workspace) return null;

  return { session, client, workspace };
}

export async function requirePortalSession(workspaceSlug: string) {
  const result = await getPortalSession(workspaceSlug);
  if (!result) {
    redirect(`/portal/${workspaceSlug}?error=unauthorized`);
  }
  return result;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  verifyPortalToken,
  hashPortalSessionToken,
  PORTAL_COOKIE,
  PORTAL_SESSION_COOKIE_PREFIX,
  PORTAL_TOKEN_TTL_MS,
  type PortalSession,
} from "./portal-auth";
import prisma from "./prisma";
import type { Client, Workspace } from "@prisma/client";

const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000; // touch lastSeenAt at most every 5 min

export interface ResolvedPortalSession {
  session: PortalSession;
  client: Client;
  workspace: Workspace;
  /** DB session row id when the cookie is a v2 server-side session (null for legacy cookies). */
  sessionId: string | null;
}

/**
 * Resolve the portal cookie to an authenticated client. S8 (R8):
 * - "v2." cookies are opaque tokens looked up in PortalSession — revocable.
 * - older HMAC cookies still verify until natural expiry, but respect
 *   Client.portalRevokedAt (tokens issued before that instant are dead).
 */
export async function getPortalSession(
  workspaceSlug: string
): Promise<ResolvedPortalSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(PORTAL_COOKIE)?.value;
  if (!token) return null;

  // ── v2: server-side session ────────────────────────────────────────────────
  if (token.startsWith(PORTAL_SESSION_COOKIE_PREFIX)) {
    const rawToken = token.slice(PORTAL_SESSION_COOKIE_PREFIX.length);
    if (!rawToken) return null;

    const row = await prisma.portalSession.findUnique({
      where: { tokenHash: hashPortalSessionToken(rawToken) },
      include: { client: true, workspace: true },
    });

    if (!row) return null;
    if (row.revokedAt) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    if (row.workspace.slug !== workspaceSlug) return null;
    if (row.client.workspaceId !== row.workspaceId) return null;
    if (
      row.client.portalRevokedAt &&
      row.createdAt.getTime() < row.client.portalRevokedAt.getTime()
    ) {
      return null;
    }

    // Throttled activity stamp — never block or fail the request on it.
    if (
      !row.lastSeenAt ||
      Date.now() - row.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS
    ) {
      prisma.portalSession
        .update({ where: { id: row.id }, data: { lastSeenAt: new Date() } })
        .catch(() => {});
    }

    return {
      session: {
        clientId: row.clientId,
        email: row.client.email,
        workspaceSlug,
        exp: row.expiresAt.getTime(),
      },
      client: row.client,
      workspace: row.workspace,
      sessionId: row.id,
    };
  }

  // ── Legacy: stateless HMAC cookie (pre-S8) ─────────────────────────────────
  const session = verifyPortalToken(token);
  if (!session || session.workspaceSlug !== workspaceSlug) return null;

  const [client, workspace] = await Promise.all([
    prisma.client.findUnique({ where: { id: session.clientId } }),
    prisma.workspace.findUnique({ where: { slug: workspaceSlug } }),
  ]);

  if (!client || !workspace) return null;
  if (client.workspaceId !== workspace.id) return null;

  // Revocation cutoff: legacy tokens carry only `exp`; issue time ≈ exp - TTL.
  if (client.portalRevokedAt) {
    const issuedAtApprox = session.exp - PORTAL_TOKEN_TTL_MS;
    if (issuedAtApprox < client.portalRevokedAt.getTime()) return null;
  }

  return { session, client, workspace, sessionId: null };
}

export async function requirePortalSession(workspaceSlug: string) {
  const result = await getPortalSession(workspaceSlug);
  if (!result) {
    redirect(`/portal/${workspaceSlug}?error=unauthorized`);
  }
  return result;
}

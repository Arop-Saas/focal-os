import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";
import type { PrismaClient, Prisma } from "@prisma/client";

// SECURITY: portal tokens are only as strong as this secret.
// PORTAL_TOKEN_SECRET is REQUIRED — no fallbacks. Without it, token
// generation throws and verification fails closed (returns null).
function getSecret(): string {
  const s = process.env.PORTAL_TOKEN_SECRET;
  if (!s) {
    throw new Error(
      "PORTAL_TOKEN_SECRET is not set — portal sessions are disabled until it is configured."
    );
  }
  return s;
}

export interface PortalSession {
  clientId: string;
  email: string;
  workspaceSlug: string;
  exp: number;
}

export const PORTAL_COOKIE = "scalist_portal_session";
export const PORTAL_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (legacy stateless cookies)
export const MAGIC_LINK_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

// ─── S8: server-side revocable sessions (R8) ─────────────────────────────────
// The session cookie is now an OPAQUE random token backed by a PortalSession
// row (sha256 hash stored, never the raw token). Revoking the row kills the
// session instantly. Stateless HMAC tokens remain in use ONLY as short-lived
// transport tokens (magic links, password reset) and as a legacy fallback for
// session cookies issued before this shipped.

export const PORTAL_SESSION_COOKIE_PREFIX = "v2.";
export const PORTAL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — revocable, so longer is safe
export const PORTAL_SESSION_TTL_SECONDS = PORTAL_SESSION_TTL_MS / 1000;

export function hashPortalSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Create a DB-backed portal session and return the cookie value to set.
 * Accepts any Prisma client (also works inside a $transaction).
 */
export async function createPortalDbSession(
  db: PrismaClient | Prisma.TransactionClient,
  args: { workspaceId: string; clientId: string; userAgent?: string | null }
): Promise<{ cookieValue: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + PORTAL_SESSION_TTL_MS);

  await db.portalSession.create({
    data: {
      workspaceId: args.workspaceId,
      clientId: args.clientId,
      tokenHash: hashPortalSessionToken(rawToken),
      userAgent: args.userAgent?.slice(0, 255) ?? null,
      expiresAt,
    },
  });

  return { cookieValue: `${PORTAL_SESSION_COOKIE_PREFIX}${rawToken}`, expiresAt };
}

// ─── Stateless HMAC tokens (magic links / password reset / legacy cookies) ───

export function generatePortalToken(session: PortalSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPortalToken(token: string): PortalSession | null {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx === -1) return null;

    const payload = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);

    const expectedSig = createHmac("sha256", getSecret())
      .update(payload)
      .digest("base64url");

    // Constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const session: PortalSession = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    );

    if (session.exp < Date.now()) return null;

    return session;
  } catch {
    return null;
  }
}

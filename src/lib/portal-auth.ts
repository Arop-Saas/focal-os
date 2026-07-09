import { createHmac, timingSafeEqual } from "crypto";

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
export const PORTAL_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const MAGIC_LINK_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

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

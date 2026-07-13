/**
 * core/delivery — gallery access security helpers.
 *
 * Passwords: scrypt-hashed ("salt:hex" format). Legacy plaintext passwords
 * verify once and are upgraded in place.
 * Media: new uploads live in the PRIVATE `media` bucket; viewing uses
 * short-lived signed URLs. Legacy media keeps its public cdnUrl.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const PRIVATE_MEDIA_BUCKET = "media";
export const SIGNED_VIEW_TTL_SECONDS = 60 * 60; // 1 hour
export const SIGNED_DOWNLOAD_TTL_SECONDS = 60;  // 1 minute

export function hashGalleryPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyGalleryPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(plain, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

let admin: ReturnType<typeof createClient> | null = null;
export function storageAdmin() {
  if (!admin) {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return admin;
}

/** Lazily create the private media bucket (idempotent). */
export async function ensurePrivateBucket(): Promise<void> {
  const { error } = await storageAdmin().storage.createBucket(PRIVATE_MEDIA_BUCKET, {
    public: false,
  });
  if (error && !/already exists/i.test(error.message)) {
    // Bucket races and "exists" are fine; anything else should surface.
    console.error("ensurePrivateBucket:", error.message);
  }
}

/** Signed VIEW url for private media; passthrough for legacy public urls. */
export async function mediaViewUrl(m: { storageKey: string; cdnUrl: string | null }): Promise<string | null> {
  if (m.cdnUrl) return m.cdnUrl; // legacy public-bucket media
  const { data, error } = await storageAdmin()
    .storage.from(PRIVATE_MEDIA_BUCKET)
    .createSignedUrl(m.storageKey, SIGNED_VIEW_TTL_SECONDS);
  if (error) { console.error("signed view url:", error.message); return null; }
  return data.signedUrl;
}

/** Signed DOWNLOAD url (attachment disposition) — only call after gates pass. */
export async function mediaDownloadUrl(
  m: { storageKey: string; cdnUrl: string | null },
  downloadName: string
): Promise<string | null> {
  if (m.cdnUrl) return m.cdnUrl;
  const { data, error } = await storageAdmin()
    .storage.from(PRIVATE_MEDIA_BUCKET)
    .createSignedUrl(m.storageKey, SIGNED_DOWNLOAD_TTL_SECONDS, { download: downloadName });
  if (error) { console.error("signed download url:", error.message); return null; }
  return data.signedUrl;
}

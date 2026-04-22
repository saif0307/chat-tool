import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison via SHA-256 digests (avoids length leaks on raw strings).
 */
export function verifySitePassword(candidate: string): boolean {
  const secret = process.env.SITE_PASSWORD;
  if (!secret || candidate === undefined || candidate === null) return false;
  const h1 = createHash("sha256").update(String(candidate), "utf8").digest();
  const h2 = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(h1, h2);
}

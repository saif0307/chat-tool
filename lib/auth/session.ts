import { SignJWT } from "jose";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export { SESSION_COOKIE };

const JWT_ALG = "HS256";

function getEncodedSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set and at least 32 characters (use a long random string).",
    );
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(): Promise<string> {
  const secret = getEncodedSecret();
  return new SignJWT({ sub: "site_access" })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const JWT_ALG = "HS256";

function getSecret(): Uint8Array | null {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s);
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)
  );
}

async function verifyCookieToken(token: string, secret: Uint8Array): Promise<boolean> {
  try {
    await jwtVerify(token, secret, { algorithms: [JWT_ALG] });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const secret = getSecret();

  /** Public login API — no session required */
  if (pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }

  /** Login page — logged-in users go home */
  if (pathname === "/login") {
    if (!secret) return NextResponse.next();
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token && (await verifyCookieToken(token, secret))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  /** Everything else requires valid env + JWT cookie */
  if (!secret) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Server misconfiguration: AUTH_SECRET is missing or too short." },
        { status: 503 },
      );
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "config");
    return NextResponse.redirect(login);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifyCookieToken(token, secret))) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { verifySitePassword } from "@/lib/auth/password";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const password = body.password;
  if (typeof password !== "string") {
    return NextResponse.json({ error: "password is required" }, { status: 400 });
  }

  if (!process.env.SITE_PASSWORD) {
    return NextResponse.json(
      { error: "Server misconfiguration: SITE_PASSWORD is not set." },
      { status: 503 },
    );
  }

  if (!verifySitePassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  let token: string;
  try {
    token = await createSessionToken();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auth misconfiguration";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true });
}

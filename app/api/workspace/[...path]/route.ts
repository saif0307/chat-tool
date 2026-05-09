import { NextResponse } from "next/server";
import { readWorkspaceFile } from "@/lib/workspace-persistence";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { path: segments } = await ctx.params;
  if (!segments?.length) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const rel = segments.map((s) => decodeURIComponent(s)).join("/");

  const result = await readWorkspaceFile(rel);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cd = `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`;

  return new NextResponse(new Uint8Array(result.body), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Length": String(result.body.length),
      "Content-Disposition": cd,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

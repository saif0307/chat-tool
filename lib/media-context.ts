import type { UIMessage } from "ai";

type ToolPart = {
  type?: string;
  state?: string;
  output?: unknown;
};

function isToolPart(part: { type?: string }): boolean {
  return typeof part.type === "string" && part.type.startsWith("tool-");
}

function mediaFromToolPart(
  part: ToolPart,
): { kind: "image" | "video"; url: string } | null {
  if (!isToolPart(part) || part.state !== "output-available") return null;
  const out = part.output;
  if (!out || typeof out !== "object") return null;
  const o = out as {
    mediaUrl?: unknown;
    mediaKind?: unknown;
    error?: unknown;
  };
  if (o.error || typeof o.mediaUrl !== "string" || !o.mediaUrl.trim()) {
    return null;
  }

  const toolType = part.type ?? "";
  if (
    toolType.includes("generate_image") ||
    toolType.includes("edit_image") ||
    o.mediaKind === "image"
  ) {
    return { kind: "image", url: o.mediaUrl };
  }
  if (
    toolType.includes("generate_video") ||
    toolType.includes("extend_video") ||
    o.mediaKind === "video"
  ) {
    return { kind: "video", url: o.mediaUrl };
  }
  return null;
}

function latestMediaInMessage(
  m: UIMessage,
  kind: "image" | "video",
): string | null {
  const prefix = kind === "image" ? "image/" : "video/";
  let latest: string | null = null;

  for (const p of m.parts) {
    const fromTool = mediaFromToolPart(p as ToolPart);
    if (fromTool?.kind === kind) latest = fromTool.url;

    if (p.type !== "file") continue;
    const fp = p as { url?: string; mediaType?: string };
    if (!fp.url?.trim()) continue;
    if (!(fp.mediaType ?? "").toLowerCase().startsWith(prefix)) continue;
    latest = fp.url;
  }

  return latest;
}

function resolveLatestMedia(
  messages: UIMessage[],
  kind: "image" | "video",
  explicit?: string[],
): string | null {
  const fromExplicit = explicit?.map((u) => u.trim()).filter(Boolean);
  if (fromExplicit?.length) {
    return fromExplicit[fromExplicit.length - 1] ?? null;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const url = latestMediaInMessage(messages[i]!, kind);
    if (url) return url;
  }
  return null;
}

/** Most recent image: user uploads or prior generate/edit tool results. */
export function resolveImageUrlForEdit(
  messages: UIMessage[],
  explicit?: string[],
): string | null {
  return resolveLatestMedia(messages, "image", explicit);
}

/** Most recent video: user uploads or prior generate/extend tool results. */
export function resolveVideoUrlForExtend(
  messages: UIMessage[],
  explicit?: string[],
): string | null {
  return resolveLatestMedia(messages, "video", explicit);
}

"use client";

import { useEffect, useMemo } from "react";
import { extensionFromFilename } from "@/lib/attachment-allowlist";
import { formatFileSize } from "@/components/attachment-display";
import type { InlinedAttachmentPayload } from "@/lib/prepare-attachments";

function mimeForDownload(filename: string): string {
  const ext = extensionFromFilename(filename).toLowerCase();
  const map: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    json: "application/json",
    xml: "application/xml",
    md: "text/markdown",
    txt: "text/plain",
    svg: "image/svg+xml",
    yaml: "application/yaml",
    yml: "application/yaml",
  };
  return map[ext] ?? "text/plain;charset=utf-8";
}

function byteLengthUtf8(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Drops lines that only repeat attachment names — preview cards already show them (incl. legacy `(file)` rows). */
export function visibleUserMessageText(
  raw: string | undefined,
  inlinedMeta: InlinedAttachmentPayload[] | undefined,
  /** e.g. filenames from `parts` image/PDF file attachments */
  extraFilenames?: readonly string[],
): string | null {
  if (!raw?.trim()) return null;

  const names = new Set<string>([
    ...(inlinedMeta?.map((x) => x.filename) ?? []),
    ...(extraFilenames ?? []).filter((x): x is string => Boolean(x)),
  ]);

  if (names.size === 0) return raw.trim();
  const lines = raw.split(/\r?\n/);
  const kept = lines.filter((line) => {
    const s = line.trim();
    if (!s) return true;
    if (names.has(s)) return false;
    if (/^\([^)]+\)$/.test(s)) {
      const inner = s.slice(1, -1).trim();
      if (names.has(inner)) return false;
      const parts = inner.split(",").map((x) => x.trim());
      if (parts.length > 0 && parts.every((n) => names.has(n))) return false;
    }
    return true;
  });
  const out = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return out.length ? out : null;
}

function previewKind(filename: string): "html" | "svg" | "code" {
  const ext = extensionFromFilename(filename).toLowerCase();
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "svg") return "svg";
  return "code";
}

export function UserInlinedAttachments({ items }: { items: InlinedAttachmentPayload[] }) {
  return (
    <div className="mt-3 flex min-w-0 flex-col gap-3">
      {items.map((item, i) => (
        <InlinedAttachmentCard key={`${item.filename}-${i}`} item={item} />
      ))}
    </div>
  );
}

function InlinedAttachmentCard({ item }: { item: InlinedAttachmentPayload }) {
  const bytes = byteLengthUtf8(item.content);
  const kind = previewKind(item.filename);

  const blobUrl = useMemo(() => {
    const blob = new Blob([item.content], { type: mimeForDownload(item.filename) });
    return URL.createObjectURL(blob);
  }, [item.content, item.filename]);

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <div className="border-foreground/12 bg-foreground/4 dark:bg-foreground/6 min-w-0 overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium" title={item.filename}>
            {item.filename}
          </p>
          <p className="text-foreground/50 text-xs">{formatFileSize(bytes)} · text</p>
        </div>
        <a
          href={blobUrl}
          download={item.filename}
          className="border-foreground/15 bg-background text-foreground hover:bg-foreground/8 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold"
        >
          Download
        </a>
      </div>
      {kind === "html" && (
        <div className="border-foreground/8 bg-background max-h-56 min-h-[160px] w-full overflow-hidden border-t">
          {/* sandbox: no scripts; enough to render structure preview */}
          <iframe
            title={item.filename}
            srcDoc={item.content}
            sandbox=""
            className="h-56 w-full bg-white dark:bg-zinc-950"
          />
        </div>
      )}
      {kind === "svg" && (
        <div className="border-foreground/8 bg-background max-h-56 overflow-auto border-t p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL from text */}
          <img src={blobUrl} alt="" className="mx-auto max-h-52 max-w-full object-contain" />
        </div>
      )}
      {kind === "code" && (
        <div className="border-foreground/8 max-h-56 overflow-auto border-t">
          <pre className="text-foreground/90 m-0 break-words p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
            {item.content.length > 12000
              ? `${item.content.slice(0, 12000)}\n\n… (${formatFileSize(bytes)} total — download for full file)`
              : item.content}
          </pre>
        </div>
      )}
    </div>
  );
}

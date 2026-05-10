"use client";

import { useCallback, useState } from "react";
import { PreviewableImage } from "@/components/image-lightbox";

export type LooseToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function labelFromType(type: string): string {
  return type.startsWith("tool-")
    ? type.slice(5).replace(/_/g, " ")
    : "tool";
}

function Spinner() {
  return (
    <span
      className="border-foreground/30 mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-sky-500"
      aria-hidden
    />
  );
}

function FalMediaToolbar({ url, kind }: { url: string; kind: "image" | "video" }) {
  const [busy, setBusy] = useState(false);

  const download = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const ext =
        kind === "video"
          ? blob.type.includes("webm")
            ? "webm"
            : "mp4"
          : blob.type.includes("png")
            ? "png"
            : blob.type.includes("webp")
              ? "webp"
              : blob.type.includes("gif")
                ? "gif"
                : "jpg";
      const name = kind === "video" ? `video.${ext}` : `image.${ext}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }, [url, kind]);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void download()}
        className="text-foreground/70 hover:bg-foreground/10 hover:text-foreground rounded-md px-2 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Downloading…" : "Download"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="text-foreground/55 hover:text-foreground text-sm font-medium underline underline-offset-4"
      >
        Open in new tab
      </a>
    </div>
  );
}

export function ToolInvocationCard({ part }: { part: LooseToolPart }) {
  const title = labelFromType(part.type);
  const query =
    part.input && typeof part.input === "object" && part.input !== null && "query" in part.input
      ? String((part.input as { query?: unknown }).query ?? "")
      : "";

  const workspaceRelPath =
    part.input && typeof part.input === "object" && part.input !== null && "relativePath" in part.input
      ? String((part.input as { relativePath?: unknown }).relativePath ?? "")
      : "";

  const isWebSearch =
    part.type.includes("web_search") || part.type === "tool-web_search";

  const isWriteWorkspace =
    part.type.includes("write_workspace_file") ||
    part.type === "tool-write_workspace_file";

  const isFalImage =
    part.type.includes("generate_image") || part.type === "tool-generate_image";
  const isFalEdit =
    part.type.includes("edit_image") || part.type === "tool-edit_image";
  const isFalVideo =
    part.type.includes("generate_video") || part.type === "tool-generate_video";

  if (part.state === "output-error" || part.errorText) {
    return (
      <div className="border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-200 mb-2 rounded-lg border px-3 py-2 text-sm">
        <span className="font-medium">{title}</span>: {part.errorText ?? "Tool failed"}
      </div>
    );
  }

  if (
    part.state === "output-available" &&
    part.output &&
    typeof part.output === "object" &&
    part.output !== null &&
    "error" in part.output
  ) {
    const err = String((part.output as { error?: unknown }).error ?? "");
    return (
      <div className="border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100 mb-2 rounded-lg border px-3 py-2 text-sm">
        <span className="font-medium">{title}</span>: {err}
      </div>
    );
  }

  /** In-flight tool — show realtime feedback before results land */
  if (part.state === "input-streaming" || part.state === "input-available") {
    const phase =
      part.state === "input-streaming"
        ? isWebSearch
          ? "Preparing web search…"
          : `Preparing ${title}…`
        : isWebSearch
          ? "Searching the web…"
          : isWriteWorkspace
            ? "Preparing file…"
            : isFalEdit
              ? "Editing image…"
              : isFalImage
                ? "Creating image…"
                : isFalVideo
                  ? "Rendering video…"
                  : `Calling ${title}…`;
    return (
      <div className="border-sky-500/30 bg-sky-500/[0.07] mb-3 flex gap-3 rounded-lg border px-3 py-2.5 text-sm shadow-sm">
        <Spinner />
        <div className="min-w-0">
          <div className="text-foreground font-medium">{phase}</div>
          {query ? (
            <div className="text-foreground/65 mt-1 font-mono text-xs leading-snug">
              Query: “{query}”
            </div>
          ) : workspaceRelPath ? (
            <div className="text-foreground/55 mt-1 text-xs">Almost ready…</div>
          ) : (
            <div className="text-foreground/55 mt-0.5 animate-pulse text-xs">Gathering arguments…</div>
          )}
        </div>
      </div>
    );
  }

  if (part.state === "output-available" && part.output) {
    const out = part.output as {
      query?: string;
      relativePath?: string;
      bytesWritten?: number;
      downloadUrlPath?: string;
      results?: Array<{ rank?: number; title?: string; url?: string; snippet?: string }>;
    };

    const falUrl =
      typeof (out as { mediaUrl?: unknown }).mediaUrl === "string"
        ? (out as { mediaUrl: string }).mediaUrl
        : "";
    const falKind = (out as { mediaKind?: unknown }).mediaKind;

    if (
      falUrl &&
      (falKind === "image" ||
        falKind === "video" ||
        isFalImage ||
        isFalEdit ||
        isFalVideo)
    ) {
      const kind = falKind === "video" || isFalVideo ? "video" : "image";
      const caption =
        typeof (out as { caption?: unknown }).caption === "string"
          ? (out as { caption: string }).caption
          : "";
      return (
        <div className="border-violet-500/30 bg-violet-500/[0.06] mb-3 overflow-hidden rounded-lg border shadow-sm">
          <div className="text-foreground border-violet-500/20 border-b px-3 py-2 text-sm font-medium">
            {kind === "video" ? "Video" : "Image"} ready
          </div>
          <div className="px-3 pb-3 pt-2">
            {kind === "video" ? (
              <video
                src={falUrl}
                controls
                playsInline
                className="bg-foreground/5 max-h-[min(70vh,520px)] w-full rounded-lg"
                preload="metadata"
              />
            ) : (
              <PreviewableImage
                src={falUrl}
                alt={caption || "Generated image"}
                className="bg-foreground/5 max-h-[min(70vh,520px)] w-full rounded-lg object-contain"
              />
            )}
            <FalMediaToolbar url={falUrl} kind={kind} />
          </div>
        </div>
      );
    }

    if (isWriteWorkspace && typeof out.relativePath === "string") {
      const href = out.downloadUrlPath ?? "";
      const base =
        out.relativePath.includes("/") ? out.relativePath.split("/").pop() : out.relativePath;
      const downloadName = base && base.length > 0 ? base : "download";
      return (
        <div className="border-emerald-500/30 bg-emerald-500/[0.07] mb-3 rounded-lg border px-3 py-2.5 text-sm shadow-sm">
          <div className="text-foreground mb-1 text-sm font-medium">Ready to download</div>
          <div className="text-foreground/80 text-[13px]">{downloadName}</div>
          {href ? (
            <a
              href={href}
              download={downloadName}
              className="mt-2 inline-block font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
              rel="noreferrer noopener"
            >
              Download
            </a>
          ) : null}
        </div>
      );
    }

    const rows = out.results ?? [];
    if (rows.length > 0) {
      return (
        <div className="border-foreground/12 bg-foreground/[0.03] mb-3 rounded-lg border px-3 py-2 text-sm">
          <div className="text-foreground/65 mb-1 flex flex-wrap items-baseline gap-2 text-xs font-semibold uppercase tracking-wide">
            Web search
            {query || out.query ? (
              <span className="text-foreground/85 font-normal normal-case">
                “{query || out.query}”
              </span>
            ) : null}
          </div>
          <ul className="border-foreground/10 mt-2 space-y-2 border-t pt-2">
            {rows.slice(0, 6).map((r, i) => (
              <li key={`${r.url}-${i}`} className="text-[13px] leading-snug">
                <span className="text-foreground/55 mr-2 font-mono text-[11px]">{r.rank ?? i + 1}</span>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  {r.title ?? "Link"}
                </a>
                {r.snippet ? (
                  <p className="text-foreground/70 mt-0.5 pl-7">{r.snippet}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    /** Provider-native search often returns structured blobs instead of `results`. */
    return (
      <details className="border-foreground/12 bg-foreground/[0.03] mb-3 rounded-lg border px-3 py-2 text-sm">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-foreground/65">
          {isWriteWorkspace ? "Details" : "Web search (details)"}
        </summary>
        <pre className="text-foreground/75 mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
          {JSON.stringify(out, null, 2).slice(0, 8000)}
        </pre>
      </details>
    );
  }

  /** Tool running — unknown intermediate state */
  if (
    part.state &&
    part.state !== "output-available" &&
    part.state !== "output-error" &&
    part.state !== "output-denied"
  ) {
    return (
      <div className="border-foreground/15 bg-foreground/[0.04] mb-3 flex gap-3 rounded-lg border px-3 py-2.5 text-sm">
        <Spinner />
        <div className="min-w-0">
          <div className="text-foreground font-medium">
            {isWebSearch
              ? "Fetching web results…"
              : isWriteWorkspace
                ? "Working on your file…"
                : isFalImage
                  ? "Creating image…"
                  : isFalVideo
                    ? "Rendering video…"
                    : `${title}…`}
          </div>
          {query ? (
            <div className="text-foreground/65 mt-1 text-xs">“{query}”</div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="border-foreground/12 bg-foreground/[0.03] text-foreground/75 mb-2 flex gap-2 rounded-lg border px-3 py-2 text-sm">
      <Spinner />
      <span>
        <span className="font-medium">
          {isWebSearch
            ? "Web search"
            : isWriteWorkspace
              ? "File"
              : isFalImage
                ? "Image"
                : isFalVideo
                  ? "Video"
                  : title}
        </span>
        {query ? ` · “${query}”` : null} — starting…
      </span>
    </div>
  );
}

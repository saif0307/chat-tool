"use client";

import { useRef, useState } from "react";
import type { DraftArtifactFormat } from "@/lib/draft-artifact-parse";
import { MarkdownMessage } from "@/components/markdown-message";
import { Tooltip } from "@/components/tooltip";

type Props = {
  body: string;
  format: DraftArtifactFormat;
  /** Stream still open before [[[END DRAFT]]] */
  streaming?: boolean;
};

function formatTitle(format: DraftArtifactFormat): string {
  switch (format) {
    case "email":
      return "Draft email";
    case "markdown":
      return "Markdown";
    default:
      return "Draft";
  }
}

export function DraftArtifactCard({ body, format, streaming }: Props) {
  const [editing, setEditing] = useState(false);
  /** Only used while editing — never synced from props on every token (avoids setState-per-chunk loops). */
  const [edited, setEdited] = useState("");
  const [editMinHeightPx, setEditMinHeightPx] = useState<number | undefined>(
    undefined,
  );
  const previewRef = useRef<HTMLDivElement>(null);

  const displayTitle = formatTitle(format);

  const copyText = async () => {
    const text = editing ? edited : body;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const shareText = async () => {
    const text = editing ? edited : body;
    try {
      if (navigator.share) {
        await navigator.share({ title: displayTitle, text });
      } else {
        await copyText();
      }
    } catch {
      await copyText();
    }
  };

  const iconBtn =
    "text-foreground/50 hover:bg-foreground/10 hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors";

  function exitEdit() {
    setEditing(false);
    setEditMinHeightPx(undefined);
  }

  function enterEdit() {
    requestAnimationFrame(() => {
      const el = previewRef.current;
      setEditMinHeightPx(
        el != null ? Math.max(el.scrollHeight, 192) : undefined,
      );
      setEdited(body);
      setEditing(true);
    });
  }

  return (
    <div
      className="border-foreground/15 bg-foreground/6 mt-4 overflow-hidden rounded-2xl border shadow-inner"
      data-draft-artifact
    >
      <div className="border-foreground/10 flex items-center justify-between gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={() => (editing ? exitEdit() : enterEdit())}
          className="text-foreground/85 hover:bg-foreground/10 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          {editing ? "Done" : "Edit"}
        </button>
        <span className="text-foreground/60 min-w-0 flex-1 truncate text-center text-xs font-medium">
          {displayTitle}
          {streaming ? (
            <span className="text-foreground/45 ml-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500 align-middle" />
          ) : null}
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip content="Copy draft">
            <button
              type="button"
              onClick={() => void copyText()}
              className={iconBtn}
            >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            </button>
          </Tooltip>
          <Tooltip content="Share">
            <button
              type="button"
              onClick={() => void shareText()}
              className={iconBtn}
            >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
          </Tooltip>
        </div>
      </div>

      <div className="max-h-[min(70vh,32rem)] overflow-y-auto px-4 py-3">
        {editing ? (
          <div className="relative">
            <Tooltip content="Copy draft">
              <button
                type="button"
                onClick={() => void copyText()}
                className={`${iconBtn} absolute right-2 top-2 z-10`}
                aria-label="Copy draft"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              </button>
            </Tooltip>
            <textarea
              value={edited}
              onChange={(e) => setEdited(e.target.value)}
              spellCheck
              rows={Math.min(
                48,
                Math.max(8, (edited.match(/\n/g)?.length ?? 0) + 4),
              )}
              style={{
                minHeight:
                  editMinHeightPx != null
                    ? editMinHeightPx
                    : "min(70vh, 32rem)",
              }}
              className="border-foreground/15 bg-background text-foreground placeholder:text-foreground/35 focus:border-sky-500/50 box-border min-h-48 w-full resize-y rounded-xl border px-3 pb-2.5 pr-11 pt-10 font-mono text-[13px] leading-relaxed outline-none"
              aria-label="Edit draft"
            />
          </div>
        ) : (
          <div ref={previewRef} data-draft-preview className="min-w-0">
            {format === "plain" ? (
              <div className="markdown-body text-[15px] leading-relaxed">
                <pre className="font-sans wrap-anywhere whitespace-pre-wrap text-[15px] leading-relaxed">
                  {body}
                </pre>
              </div>
            ) : (
              <MarkdownMessage content={body} streaming={streaming} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

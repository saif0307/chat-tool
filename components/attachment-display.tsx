"use client";

import { useEffect, useState } from "react";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type MessageFilePartProps = {
  url: string;
  filename?: string;
  mediaType: string;
};

/** Renders stored message file parts (images, PDFs, media, downloads). */
export function MessageAttachmentPart({ url, filename, mediaType }: MessageFilePartProps) {
  const label = filename?.trim() || "Attachment";
  const isImg =
    mediaType.startsWith("image/") ||
    looksLikeImageFile({ type: mediaType, name: filename ?? "" });
  const isPdf =
    mediaType === "application/pdf" ||
    (!mediaType && /\.pdf$/i.test((filename ?? "").trim()));
  const isVideo = mediaType.startsWith("video/");
  const isAudio = mediaType.startsWith("audio/");

  return (
    <div className="border-foreground/15 bg-foreground/5 mt-2 overflow-hidden rounded-xl border">
      {isImg ? (
        <div className="flex flex-col gap-1 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob/data URLs from chat parts */}
          <img
            src={url}
            alt={label}
            className="mx-auto max-h-[min(28rem,calc(100vh-12rem))] max-w-full rounded-lg object-contain"
          />
          <span className="text-foreground/65 block truncate text-center text-xs">{label}</span>
        </div>
      ) : isPdf ? (
        <div className="flex flex-col gap-2 p-2">
          <object
            data={url}
            type="application/pdf"
            title={label}
            className="bg-background min-h-[420px] w-full rounded-lg border border-dashed"
          >
            <div className="text-foreground/75 flex flex-col gap-2 p-4 text-sm">
              <p>PDF preview is not available in this browser.</p>
              <a
                href={url}
                download={filename}
                className="text-sky-600 underline dark:text-sky-400"
              >
                Download {label}
              </a>
            </div>
          </object>
          <span className="text-foreground/65 truncate text-xs">{label}</span>
        </div>
      ) : isVideo ? (
        <div className="flex flex-col gap-1 p-2">
          <video src={url} controls className="max-h-64 max-w-full rounded-lg" preload="metadata" />
          <span className="text-foreground/65 truncate text-xs">{label}</span>
        </div>
      ) : isAudio ? (
        <div className="flex flex-col gap-2 p-3">
          <audio src={url} controls className="w-full max-w-md" preload="metadata" />
          <span className="text-foreground/65 truncate text-xs">{label}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 p-3">
          <span className="border-foreground/15 bg-background text-foreground/80 inline-flex min-h-14 min-w-14 shrink-0 items-center justify-center rounded-lg border font-mono text-[10px] uppercase">
            {extensionLabel(filename, mediaType)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">{label}</p>
            <p className="text-foreground/55 text-xs">{mediaType}</p>
          </div>
          <a
            href={url}
            download={filename}
            className="border-foreground/15 bg-background text-foreground hover:bg-foreground/5 shrink-0 rounded-lg border px-3 py-2 text-sm font-medium"
          >
            Download
          </a>
        </div>
      )}
    </div>
  );
}

/** Clipboard / OS files often omit MIME type; infer from extension for preview only. */
export function looksLikeImageFile(file: Pick<File, "type" | "name">): boolean {
  if (file.type.startsWith("image/")) return true;
  const name = file.name.trim().toLowerCase();
  return /\.(png|apng|jpe?g|gif|webp|bmp|svg|heif|heic|avif)$/i.test(name);
}

function looksLikePdfFile(file: Pick<File, "type" | "name">): boolean {
  if (file.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name.trim());
}

function extensionLabel(filename: string | undefined, mediaType: string): string {
  const base = filename?.split(".").pop();
  if (base && base.length <= 6 && /^[a-zA-Z0-9]+$/.test(base)) return base.slice(0, 4);
  const sub = mediaType.split("/")[1];
  return sub ? sub.slice(0, 4).toUpperCase() : "FILE";
}

type ComposerPreviewProps = {
  file: File;
  onRemove: () => void;
  disabled?: boolean;
};

/** Single pending attachment chip with thumbnail or file summary. */
export function ComposerAttachmentPreview({ file, onRemove, disabled }: ComposerPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  /* Object URL must be created in an effect: useMemo caches a URL that Strict Mode revokes on
   * fake unmount, breaking the img src. setState here is the standard blob-lifecycle pattern. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setObjectUrl(null);
    };
  }, [file]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isImg = looksLikeImageFile(file);
  const isPdf = looksLikePdfFile(file);

  return (
    <div className="border-foreground/15 bg-foreground/5 relative flex max-w-[140px] flex-col gap-1 rounded-xl border p-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="border-foreground/20 bg-background text-foreground/85 hover:bg-foreground/10 absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border text-lg leading-none disabled:opacity-40"
      >
        ×
      </button>
      <div className="flex min-h-[88px] w-full items-center justify-center overflow-hidden rounded-lg bg-zinc-200/80 dark:bg-zinc-800/90">
        {isImg && objectUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */
          <img
            src={objectUrl}
            alt=""
            className="max-h-24 min-h-[72px] min-w-[72px] max-w-full object-contain"
          />
        ) : isPdf && objectUrl ? (
          <object
            data={objectUrl}
            type="application/pdf"
            aria-label={file.name}
            className="pointer-events-none h-24 w-full rounded bg-white dark:bg-zinc-900"
          >
            <span className="text-foreground/70 px-2 text-xs">PDF</span>
          </object>
        ) : (
          <span className="text-foreground/70 px-2 text-center font-mono text-[10px] uppercase">
            {extensionLabel(file.name, file.type)}
          </span>
        )}
      </div>
      <p className="text-foreground/80 line-clamp-2 text-[11px] leading-snug" title={file.name}>
        {file.name}
      </p>
      <p className="text-foreground/50 text-[10px]">{formatFileSize(file.size)}</p>
    </div>
  );
}

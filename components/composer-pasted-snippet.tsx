"use client";

type Props = {
  previewSource: string;
  disabled?: boolean;
  onRemove: () => void;
};

/** Compact chip for large pasted code/text (keeps the composer textarea clean). */
export function ComposerPastedSnippetPreview({
  previewSource,
  disabled,
  onRemove,
}: Props) {
  const preview =
    previewSource.length > 480
      ? `${previewSource.slice(0, 480)}…`
      : previewSource;

  return (
    <div className="border-foreground/15 bg-foreground/5 relative flex w-[min(100%,13.5rem)] flex-col gap-1.5 rounded-xl border p-2 pt-2.5 shadow-sm dark:bg-zinc-800/70">
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label="Remove pasted snippet"
        className="text-foreground/45 hover:bg-foreground/15 hover:text-foreground absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none transition-colors disabled:opacity-40"
      >
        ×
      </button>
      <div className="text-foreground/75 max-h-[5.5rem] min-h-[3rem] overflow-hidden px-0.5 font-mono text-[10px] leading-snug wrap-break-word whitespace-pre-wrap">
        {preview}
      </div>
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider dark:bg-zinc-950 dark:text-zinc-100">
          Pasted
        </span>
      </div>
    </div>
  );
}

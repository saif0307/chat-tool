"use client";

import { useState, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";

export function StudioComposer({
  onSend,
  onStop,
  isStreaming,
  placeholder = "Give me a topic, a link, or a rough idea to research…",
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-foreground/10 bg-background/95 safe-area-pb shrink-0 border-t px-4 py-3 backdrop-blur-sm sm:px-6">
      <div className="border-foreground/15 focus-within:border-foreground/25 mx-auto flex w-full max-w-[min(100%,52rem)] items-end gap-2 rounded-2xl border px-3 py-2 shadow-sm transition-colors">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          className="text-foreground placeholder:text-foreground/40 max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent py-1 text-[15px] leading-relaxed outline-none"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="bg-foreground/10 text-foreground hover:bg-foreground/15 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <Square className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            aria-label="Send message"
            className="bg-foreground text-background hover:opacity-90 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <p className="text-foreground/35 mx-auto mt-2 w-full max-w-[min(100%,52rem)] text-center text-[11px]">
        Content Studio researches and reasons here. Publishing is always done by you, elsewhere.
      </p>
    </div>
  );
}

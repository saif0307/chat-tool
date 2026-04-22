"use client";

import type { ChatStatus, UIMessage } from "ai";
import { useMemo } from "react";
import { getLiveActivityLabel } from "@/lib/stream-activity";

type Props = {
  messages: UIMessage[];
  status: ChatStatus;
};

export function StreamActivityBar({ messages, status }: Props) {
  const label = useMemo(() => getLiveActivityLabel(messages, status), [messages, status]);

  if (!label) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="border-foreground/10 bg-foreground/[0.04] text-foreground/85 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm"
    >
      <span
        className="border-foreground/35 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-sky-500"
        aria-hidden
      />
      <span className="min-w-0 leading-snug">{label}</span>
    </div>
  );
}

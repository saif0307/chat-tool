"use client";

import type { ChatStatus, UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";
import { getLiveActivityLabel } from "@/lib/stream-activity";

type Props = {
  messages: UIMessage[];
  status: ChatStatus;
};

function formatElapsed(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return s < 10 ? `${s.toFixed(1)}s` : `${Math.floor(s)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.floor(s % 60);
  return `${m}m ${rest}s`;
}

export function StreamActivityBar({ messages, status }: Props) {
  const label = useMemo(() => getLiveActivityLabel(messages, status), [messages, status]);
  const [elapsedLabel, setElapsedLabel] = useState("0.0s");

  useEffect(() => {
    if (!label) return;
    const started = Date.now();
    const tick = () => setElapsedLabel(formatElapsed(Date.now() - started));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [label]);

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
      <span className="min-w-0 leading-snug">
        <span className="text-foreground/90">{label}</span>
        <span className="text-foreground/50 tabular-nums"> · {elapsedLabel}</span>
      </span>
    </div>
  );
}

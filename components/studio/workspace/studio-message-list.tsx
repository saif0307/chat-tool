"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { StudioMessage } from "@/components/studio/workspace/studio-message";

export function StudioMessageList({
  messages,
  isStreaming,
  onSelectAngle,
}: {
  messages: UIMessage[];
  isStreaming: boolean;
  onSelectAngle?: (text: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, isStreaming]);

  return (
    <div className="mx-auto flex w-full max-w-[min(100%,52rem)] flex-col gap-6 px-4 py-6 sm:px-6">
      {messages.map((m) => (
        <StudioMessage key={m.id} message={m} onSelectAngle={onSelectAngle} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

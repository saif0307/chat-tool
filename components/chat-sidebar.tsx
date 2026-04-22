"use client";

import { useRouter } from "next/navigation";
import type { ChatSession } from "@/lib/chat-storage";

type Props = {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

export function ChatSidebar({ sessions, activeId, onSelect, onNew, onDelete }: Props) {
  const router = useRouter();
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="border-foreground/10 bg-background flex min-h-0 w-[min(100%,280px)] shrink-0 flex-col border-r">
      <div className="flex items-center gap-2 border-b border-transparent p-3">
        <button
          type="button"
          onClick={onNew}
          className="bg-foreground text-background hover:opacity-90 flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
        >
          New chat
        </button>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {sorted.map((s) => (
          <div
            key={s.id}
            className={`group flex items-start gap-1 rounded-lg ${
              s.id === activeId ? "bg-foreground/10" : "hover:bg-foreground/5"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className="min-w-0 flex-1 px-3 py-2 text-left"
            >
              <div className="truncate text-sm font-medium">{s.title}</div>
              <div className="text-foreground/45 text-xs capitalize">
                {s.provider === "openai" ? "OpenAI" : "Anthropic"}
                {s.maxMode ? " · Max" : ""}
              </div>
            </button>
            <button
              type="button"
              title="Delete chat"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
              className="text-foreground/35 hover:text-foreground/80 shrink-0 rounded p-2 text-lg leading-none opacity-0 transition-opacity group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </nav>
      <div className="border-foreground/10 mt-auto shrink-0 border-t p-3">
        <button
          type="button"
          onClick={() => void signOut()}
          className="border-foreground/15 text-foreground/80 hover:bg-foreground/5 w-full rounded-lg border px-3 py-2 text-sm font-medium"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

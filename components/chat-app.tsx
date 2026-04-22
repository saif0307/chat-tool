"use client";

import { generateId } from "ai";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useState } from "react";
import {
  defaultModel,
  type ProviderId,
} from "@/lib/models";
import {
  loadSessions,
  saveSessions,
  type ChatSession,
} from "@/lib/chat-storage";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ChatSessionView } from "@/components/chat-session-view";

function makeEmptySession(): ChatSession {
  const id = generateId();
  return {
    id,
    title: "New chat",
    updatedAt: Date.now(),
    provider: "openai",
    model: defaultModel("openai"),
    maxMode: false,
    enableWebSearch: true,
    messages: [],
  };
}

export function ChatApp() {
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const stored = loadSessions();
    if (stored.length === 0) {
      const first = makeEmptySession();
      setSessions([first]);
      setActiveId(first.id);
      saveSessions([first]);
    } else {
      setSessions(stored);
      const newest = [...stored].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      setActiveId(newest.id);
    }
  }, []);

  const mergeSession = useCallback((id: string, patch: Partial<ChatSession>) => {
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
      );
      saveSessions(next);
      return next;
    });
  }, []);

  const handleNewChat = useCallback(() => {
    const s = makeEmptySession();
    setSessions((prev) => {
      const next = [...prev, s];
      saveSessions(next);
      return next;
    });
    setActiveId(s.id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setSessions((prev) => {
      let next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh = makeEmptySession();
        next = [fresh];
        setActiveId(fresh.id);
      } else if (activeId === id) {
        const fallback = [...next].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        setActiveId(fallback.id);
      }
      saveSessions(next);
      return next;
    });
  }, [activeId]);

  const handleFork = useCallback(
    (
      forkedMessages: UIMessage[],
      titleHint: string,
      opts: {
        provider: ProviderId;
        model: string;
        maxMode: boolean;
        enableWebSearch?: boolean;
      },
    ) => {
      const newSession: ChatSession = {
        id: generateId(),
        title: titleHint.slice(0, 80),
        updatedAt: Date.now(),
        provider: opts.provider,
        model: opts.model,
        maxMode: opts.maxMode,
        enableWebSearch: opts.enableWebSearch ?? true,
        messages: forkedMessages,
      };
      setSessions((prev) => {
        const next = [...prev, newSession];
        saveSessions(next);
        return next;
      });
      setActiveId(newSession.id);
    },
    [],
  );

  const active = sessions.find((s) => s.id === activeId);

  if (!mounted || !activeId || !active) {
    return (
      <div className="text-foreground/50 flex flex-1 items-center justify-center p-8 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1">
      <ChatSidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNewChat}
        onDelete={handleDelete}
      />
      <ChatSessionView
        key={active.id}
        session={active}
        onPersist={mergeSession}
        onFork={handleFork}
      />
    </div>
  );
}

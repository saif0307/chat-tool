"use client";

import { generateId } from "ai";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  loadSessions,
  saveSessions,
  type ChatSession,
} from "@/lib/chat-storage";
import {
  loadAppChatSettings,
  saveAppChatSettings,
  normalizeAppChatSettings,
  type AppChatSettings,
  defaultAppChatSettings,
} from "@/lib/user-settings";
import { ActiveChatControlsProvider } from "@/components/active-chat-controls-context";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ChatSessionView } from "@/components/chat-session-view";

function makeEmptySession(): ChatSession {
  const id = generateId();
  return {
    id,
    title: "New chat",
    updatedAt: Date.now(),
    messages: [],
  };
}

export function ChatApp() {
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppChatSettings>(defaultAppChatSettings);
  /** Apply after `sessions` commits — avoids active id updating before / without the new session row. */
  const pendingActivateIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setAppSettings(loadAppChatSettings());
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

  /** If active id drifts from session list (storage bugs), recover instead of infinite “Loading…”. */
  useEffect(() => {
    if (!mounted || sessions.length === 0) return;
    const valid =
      activeId != null && sessions.some((s) => s.id === activeId);
    if (valid) return;
    const fallback = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    setActiveId(fallback.id);
  }, [mounted, sessions, activeId]);

  useLayoutEffect(() => {
    const id = pendingActivateIdRef.current;
    if (id === null) return;
    pendingActivateIdRef.current = null;
    setActiveId(id);
  }, [sessions]);

  const selectSession = useCallback((id: string) => {
    pendingActivateIdRef.current = null;
    setActiveId(id);
  }, []);

  const updateAppSettings = useCallback((next: AppChatSettings) => {
    const normalized = normalizeAppChatSettings(next);
    setAppSettings(normalized);
    saveAppChatSettings(normalized);
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
    setSessions((prev) => {
      const existingEmpty = prev.find((s) => s.messages.length === 0);
      if (existingEmpty) {
        pendingActivateIdRef.current = existingEmpty.id;
        return prev;
      }
      const s = makeEmptySession();
      const next = [...prev, s];
      saveSessions(next);
      pendingActivateIdRef.current = s.id;
      return next;
    });
  }, []);

  const handleRenameSession = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim();
      mergeSession(id, {
        title: trimmed.length ? trimmed.slice(0, 120) : "New chat",
        titleMode: "manual",
      });
    },
    [mergeSession],
  );

  const handleDelete = useCallback((id: string) => {
    setSessions((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((s) => s.id !== id);
      saveSessions(next);
      if (activeId === id) {
        const fallback = [...next].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        pendingActivateIdRef.current = fallback.id;
      }
      return next;
    });
  }, [activeId]);

  const handleFork = useCallback((forkedMessages: UIMessage[], titleHint: string) => {
    const newSession: ChatSession = {
      id: generateId(),
      title: titleHint.slice(0, 80),
      titleMode: "auto",
      updatedAt: Date.now(),
      messages: forkedMessages,
    };
    pendingActivateIdRef.current = newSession.id;
    setSessions((prev) => {
      const next = [...prev, newSession];
      saveSessions(next);
      return next;
    });
  }, []);

  const active = sessions.find((s) => s.id === activeId);

  if (!mounted || !activeId || !active) {
    return (
      <div className="text-foreground/50 flex flex-1 items-center justify-center p-8 text-sm">
        Loading…
      </div>
    );
  }

  const canCreateNewChat = !sessions.some((s) => s.messages.length === 0);

  return (
    <ActiveChatControlsProvider>
      <div className="flex h-full min-h-0 flex-1">
        <ChatSidebar
          sessions={sessions}
          activeId={activeId}
          canCreateNewChat={canCreateNewChat}
          onSelect={selectSession}
          onNew={handleNewChat}
          onDelete={handleDelete}
          onRenameSession={handleRenameSession}
          appSettings={appSettings}
        />
        <ChatSessionView
          key={active.id}
          session={active}
          appSettings={appSettings}
          onAppSettingsChange={updateAppSettings}
          onPersist={mergeSession}
          onFork={handleFork}
        />
      </div>
    </ActiveChatControlsProvider>
  );
}

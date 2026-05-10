"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChatSession } from "@/lib/chat-storage";
import { useActiveChatControls } from "@/components/active-chat-controls-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip } from "@/components/tooltip";
import { resolveEffectiveModel } from "@/lib/models";
import type { AppChatSettings } from "@/lib/user-settings";

const STORAGE_EXPANDED_KEY = "my-chatbot-sidebar-expanded-v1";

type Props = {
  sessions: ChatSession[];
  activeId: string | null;
  canCreateNewChat: boolean;
  appSettings: AppChatSettings;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
};

function PanelToggleIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" x2="9" y1="4" y2="20" />
      {open ? (
        <>
          <line x1="14" x2="17" y1="9" y2="9" />
          <line x1="14" x2="17" y1="15" y2="15" />
        </>
      ) : null}
    </svg>
  );
}

export function ChatSidebar({
  sessions,
  activeId,
  canCreateNewChat,
  appSettings,
  onSelect,
  onNew,
  onDelete,
  onRenameSession,
}: Props) {
  const router = useRouter();
  const controls = useActiveChatControls();
  const sorted = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions],
  );

  const [expanded, setExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pendingSearchFocusRef = useRef(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_EXPANDED_KEY);
      if (v !== null) setExpanded(v === "true");
    } catch {
      // ignore
    }
  }, []);

  const persistExpanded = useCallback((next: boolean) => {
    setExpanded(next);
    try {
      localStorage.setItem(STORAGE_EXPANDED_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  const toggleExpanded = useCallback(() => {
    persistExpanded(!expanded);
  }, [expanded, persistExpanded]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((s) => s.title.toLowerCase().includes(q));
  }, [sorted, searchQuery]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const fallbackSummary = useMemo(() => {
    const model = resolveEffectiveModel(
      appSettings.provider,
      appSettings.model,
      appSettings.maxMode,
    );
    const parts = [
      appSettings.provider === "openai" ? "OpenAI" : "Anthropic",
      appSettings.maxMode ? "Max" : model,
      appSettings.enableWebSearch === false ? "Web off" : null,
    ].filter(Boolean) as string[];
    return parts.join(" · ");
  }, [
    appSettings.provider,
    appSettings.model,
    appSettings.maxMode,
    appSettings.enableWebSearch,
  ]);

  const summaryLine =
    controls?.settingsSummaryLine ?? fallbackSummary;

  useEffect(() => {
    if (!editingId) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [editingId]);

  useEffect(() => {
    if (!expanded || !pendingSearchFocusRef.current) return;
    pendingSearchFocusRef.current = false;
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [expanded]);

  const commitRename = useCallback(() => {
    if (!editingId) return;
    onRenameSession(editingId, draftTitle);
    setEditingId(null);
  }, [draftTitle, editingId, onRenameSession]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
  }, []);

  const openSearchFromRail = useCallback(() => {
    pendingSearchFocusRef.current = true;
    persistExpanded(true);
  }, [persistExpanded]);

  const expandHistory = useCallback(() => {
    persistExpanded(true);
  }, [persistExpanded]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/login");
    router.refresh();
  }

  const allowDelete = sessions.length > 1;

  const newChatTooltip = canCreateNewChat
    ? "New chat"
    : "You already have an empty chat — select or use it first";

  const iconBtnClass =
    "text-foreground/55 hover:bg-foreground/10 hover:text-foreground inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  const footerIconBtnClass =
    "text-foreground/55 hover:bg-foreground/10 hover:text-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  const collapsedRail = (
    <div className="flex min-h-0 flex-1 flex-col items-center px-1 py-3">
      <div className="flex flex-col items-center gap-2">
        <Tooltip content="Open sidebar" placement="right">
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={false}
            aria-label="Open sidebar"
            className={iconBtnClass}
          >
            <PanelToggleIcon open={false} />
          </button>
        </Tooltip>

        <Tooltip content={newChatTooltip} placement="right">
          <button
            type="button"
            onClick={onNew}
            disabled={!canCreateNewChat}
            aria-label="New chat"
            className={iconBtnClass}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px]"
              aria-hidden
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        </Tooltip>

        <Tooltip content="Search chats" placement="right">
          <button
            type="button"
            onClick={openSearchFromRail}
            aria-label="Search chats"
            className={iconBtnClass}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px]"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        </Tooltip>

        <Tooltip content="Chat history" placement="right">
          <button
            type="button"
            onClick={expandHistory}
            aria-label="Chat history"
            className={iconBtnClass}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px]"
              aria-hidden
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1" />

      <div className="flex flex-col items-center gap-2">
        <Tooltip content="Settings" placement="right">
          <button
            type="button"
            onClick={() => controls?.openSettings()}
            disabled={!controls}
            aria-label="Open settings"
            className={iconBtnClass}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px]"
              aria-hidden
            >
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </button>
        </Tooltip>

        <ThemeToggle variant="icon" />

        <Tooltip content="Sign out" placement="right">
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            className="text-foreground/55 hover:bg-foreground/10 hover:text-foreground inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px]"
              aria-hidden
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>
  );

  const expandedPanel = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-foreground/10 flex shrink-0 items-center gap-2 border-b px-2 py-1.5">
        <Tooltip
          content="Close sidebar"
          placement="bottom"
        >
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            aria-label="Close sidebar"
            className={iconBtnClass}
          >
            <PanelToggleIcon open />
          </button>
        </Tooltip>
        <span className="text-foreground truncate text-sm font-semibold">
          Chats
        </span>
      </div>

      <div className="border-foreground/10 shrink-0 border-b px-2 py-1.5">
        <label className="text-foreground/55 sr-only" htmlFor="sidebar-chat-search">
          Search chats
        </label>
        <input
          ref={searchInputRef}
          id="sidebar-chat-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search chats…"
          autoComplete="off"
          className="border-foreground/15 bg-background text-foreground placeholder:text-foreground/40 focus:border-foreground/25 w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500/40"
        />
      </div>

      <div className="border-b border-transparent px-2 pb-2 pt-1">
        <Tooltip content={newChatTooltip}>
          <button
            type="button"
            onClick={onNew}
            disabled={!canCreateNewChat}
            className="bg-foreground text-background hover:opacity-90 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0 opacity-90"
              aria-hidden
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            New chat
          </button>
        </Tooltip>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 py-1">
        {filteredSessions.length === 0 ? (
          <p className="text-foreground/45 px-3 py-6 text-center text-sm">
            {sorted.length === 0
              ? "No chats yet."
              : "No chats match your search."}
          </p>
        ) : (
          filteredSessions.map((s) => (
            <div
              key={s.id}
              className={`group flex items-start gap-1 rounded-lg ${
                s.id === activeId ? "bg-foreground/10" : "hover:bg-foreground/5"
              }`}
            >
              {editingId === s.id ? (
                <input
                  ref={editInputRef}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={() => void commitRename()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  className="border-foreground/20 bg-background text-foreground mx-2 my-1.5 min-w-0 flex-1 rounded-md border px-2 py-1 text-sm outline-none ring-sky-500 focus:ring-2"
                  aria-label="Chat title"
                />
              ) : (
                <Tooltip content="Double-click to rename">
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      setDraftTitle(s.title);
                      setEditingId(s.id);
                    }}
                    className="min-w-0 flex-1 px-2.5 py-1.5 text-left"
                  >
                    <div className="truncate text-sm font-medium">{s.title}</div>
                  </button>
                </Tooltip>
              )}
              {allowDelete && editingId !== s.id ? (
                <Tooltip content="Delete chat">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    className="text-foreground/35 hover:bg-foreground/10 hover:text-foreground/90 shrink-0 rounded-md p-1.5 text-lg leading-none opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    ×
                  </button>
                </Tooltip>
              ) : null}
            </div>
          ))
        )}
      </nav>

      <div className="border-foreground/10 mt-auto flex shrink-0 flex-col gap-1.5 border-t px-2 py-2">
        <Tooltip content="Model and options for the active chat">
          <p className="text-foreground/45 cursor-default truncate px-0.5 text-[10px] leading-tight tabular-nums">
            {summaryLine}
          </p>
        </Tooltip>
        <div className="flex items-center justify-center gap-2">
          <Tooltip content="Settings">
            <button
              type="button"
              onClick={() => controls?.openSettings()}
              disabled={!controls}
              aria-label="Open settings"
              className={footerIconBtnClass}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[17px] w-[17px]"
                aria-hidden
              >
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>
          </Tooltip>
          <ThemeToggle variant="icon" />
          <Tooltip content="Sign out">
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              className={`${footerIconBtnClass} rounded-full`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[17px] w-[17px]"
                aria-hidden
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  return (
    <aside
      className={`border-foreground/10 bg-background flex min-h-0 shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 ease-out ${
        expanded ? "w-[min(100%,280px)]" : "w-14"
      }`}
    >
      {!expanded ? collapsedRail : expandedPanel}
    </aside>
  );
}

import type { UIMessage } from "ai";
import type { ProviderId } from "./models";

const STORAGE_KEY = "my-chatbot-sessions-v1";

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  provider: ProviderId;
  model: string;
  maxMode: boolean;
  /** Default true when omitted */
  enableWebSearch?: boolean;
  messages: UIMessage[];
};

export function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data as ChatSession[];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // quota or private mode
  }
}

export function defaultTitleFromMessages(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  for (const p of first.parts) {
    if (p.type === "text" && p.text?.trim()) {
      const t = p.text.trim().replace(/\s+/g, " ");
      return t.length > 48 ? `${t.slice(0, 45)}…` : t;
    }
  }
  return "New chat";
}

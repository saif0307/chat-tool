import type { UIMessage } from "ai";

const STORAGE_KEY = "my-chatbot-sessions-v1";

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
};

function normalizeSessionEntry(raw: unknown): ChatSession | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  const title = typeof o.title === "string" ? o.title : "New chat";
  const updatedAt = typeof o.updatedAt === "number" ? o.updatedAt : Date.now();
  const messages = Array.isArray(o.messages) ? (o.messages as UIMessage[]) : [];
  return { id, title, updatedAt, messages };
}

export function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const next: ChatSession[] = [];
    for (const item of data) {
      const s = normalizeSessionEntry(item);
      if (s) next.push(s);
    }
    return next;
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
  const inlined = (
    first.metadata as { inlinedForModel?: Array<{ filename: string }> } | undefined
  )?.inlinedForModel;
  const name = inlined?.[0]?.filename?.trim();
  if (name) {
    const t = name.replace(/\s+/g, " ");
    return t.length > 48 ? `${t.slice(0, 45)}…` : t;
  }
  return "New chat";
}

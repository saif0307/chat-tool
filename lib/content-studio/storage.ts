import type { UIMessage } from "ai";
import type { ContentProject } from "@/lib/content-studio/types";

/** Own namespace — fully independent from the chatbot's `my-chatbot-sessions-v1` key. */
const STORAGE_KEY = "content-studio-projects-v1";

function normalizeProject(raw: unknown): ContentProject | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;

  return {
    id,
    title: typeof o.title === "string" ? o.title : "Untitled project",
    titleMode: o.titleMode === "manual" || o.titleMode === "auto" ? o.titleMode : undefined,
    createdAt: typeof o.createdAt === "number" ? o.createdAt : Date.now(),
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : Date.now(),
    messages: Array.isArray(o.messages) ? (o.messages as UIMessage[]) : [],
  };
}

export function loadProjects(): ContentProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const next: ContentProject[] = [];
    for (const item of data) {
      const p = normalizeProject(item);
      if (p) next.push(p);
    }
    return next;
  } catch {
    return [];
  }
}

export function saveProjects(projects: ContentProject[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // quota or private mode
  }
}

export function defaultTitleFromMessages(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "Untitled project";
  for (const p of first.parts) {
    if (p.type === "text" && p.text?.trim()) {
      const t = p.text.trim().replace(/\s+/g, " ");
      return t.length > 48 ? `${t.slice(0, 45)}…` : t;
    }
  }
  return "Untitled project";
}

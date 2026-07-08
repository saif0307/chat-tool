import { MessagesSquare, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppId = "chat" | "content-studio";

export type AppDefinition = {
  id: AppId;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Route prefix used to detect the active app from the current pathname. */
  matchPrefix: string;
};

/**
 * Central registry for the App Switcher. Adding a future app is a single entry here —
 * nothing else about the switcher needs to change.
 */
export const APPS: AppDefinition[] = [
  {
    id: "chat",
    name: "AI Chat",
    description: "General-purpose assistant for everyday tasks",
    href: "/",
    icon: MessagesSquare,
    matchPrefix: "/",
  },
  {
    id: "content-studio",
    name: "Content Studio",
    description: "Research, brainstorm, and write exceptional content",
    href: "/studio",
    icon: Sparkles,
    matchPrefix: "/studio",
  },
];

/** Non-root prefixes are checked first so `/studio/...` doesn't fall through to the root app. */
export function activeAppIdForPath(pathname: string): AppId {
  const specific = APPS.filter((a) => a.matchPrefix !== "/");
  const match = specific.find(
    (a) => pathname === a.matchPrefix || pathname.startsWith(`${a.matchPrefix}/`),
  );
  return match?.id ?? "chat";
}

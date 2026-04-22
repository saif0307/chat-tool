import type { ChatStatus, UIMessage } from "ai";

function messageHasFiles(m: UIMessage): boolean {
  return m.parts.some((p) => p.type === "file");
}

function humanizeToolType(toolType: string): string {
  const name = toolType.startsWith("tool-") ? toolType.slice(5) : toolType;
  return name.replace(/_/g, " ");
}

function isWebSearchToolType(type: string): boolean {
  return type.includes("web_search");
}

/** Best-effort label for in-flight tool work (matches AI SDK tool part states). */
export function getLiveActivityLabel(messages: UIMessage[], status: ChatStatus): string | null {
  if (status === "ready") return null;

  const last = messages[messages.length - 1];

  if (status === "submitted") {
    if (last?.role === "user" && messageHasFiles(last)) {
      return "Sending attachments — the model will read your files next…";
    }
    return "Connecting to the model…";
  }

  if (status === "streaming" && last?.role === "assistant") {
    for (const part of last.parts) {
      if (part.type === "step-start") {
        return "Continuing…";
      }
      if (part.type === "dynamic-tool") {
        const st = (part as { state?: string }).state;
        if (st && st !== "output-available" && st !== "output-error") {
          return `Running tool (${(part as { toolName?: string }).toolName ?? "tool"})…`;
        }
      }
      if (typeof part.type === "string" && part.type.startsWith("tool-")) {
        const st = (part as { state?: string }).state;
        const t = part.type;
        if (st === "input-streaming") {
          return isWebSearchToolType(t)
            ? "Preparing web search…"
            : `Preparing ${humanizeToolType(t)}…`;
        }
        if (st === "input-available") {
          return isWebSearchToolType(t)
            ? "Searching the web…"
            : `Running ${humanizeToolType(t)}…`;
        }
        if (
          st &&
          st !== "output-available" &&
          st !== "output-error" &&
          st !== "output-denied"
        ) {
          return isWebSearchToolType(t)
            ? "Fetching web results…"
            : `${humanizeToolType(t)}…`;
        }
      }
      if (part.type === "reasoning") {
        const st = (part as { state?: string }).state;
        if (st === "streaming") return "Thinking…";
      }
      if (part.type === "text") {
        const st = (part as { state?: string }).state;
        if (st === "streaming") return "Writing response…";
      }
    }
    return "Working…";
  }

  if (status === "error") return null;

  return null;
}
